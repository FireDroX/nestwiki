import { posix } from 'node:path';
import type { Readable } from 'node:stream';
import { fromBufferPromise, type Entry, type ZipFile } from 'yauzl';
import { ImportTooLargeException } from '../../common/exceptions/imports/import-too-large.exception.js';
import { InvalidImportArchiveException } from '../../common/exceptions/imports/invalid-import-archive.exception.js';
import { UnsafeImportPathException } from '../../common/exceptions/imports/unsafe-import-path.exception.js';
import { UnsupportedImportFileException } from '../../common/exceptions/imports/unsupported-import-file.exception.js';
import {
  IMPORT_MAX_ARCHIVE_SIZE_MB,
  IMPORT_MAX_ARCHIVE_SIZE_BYTES,
  IMPORT_MAX_UNCOMPRESSED_SIZE_BYTES,
  IMPORT_MAX_UNCOMPRESSED_SIZE_MB,
} from '../../common/variables.global.js';

export interface UploadedImportFile {
  originalname: string;
  size: number;
  buffer: Buffer;
}

export interface ImportSourceFile {
  path: string;
  data: Buffer;
}

export type IgnoredImportFileReason =
  'symlink' | 'encrypted' | 'unsupported_type' | 'too_large' | 'unreferenced';

export interface IgnoredImportFile {
  path: string;
  reason: IgnoredImportFileReason;
}

export interface ImportArchiveContent {
  files: ImportSourceFile[];
  ignored: IgnoredImportFile[];
  hiddenPaths: string[];
}

const MARKDOWN_EXTENSIONS = ['.md', '.markdown'];
const SYMLINK_MODE = 0o120000;
const FILE_TYPE_MASK = 0o170000;
const UTF8_NAME_FLAG = 0x800;
const SYSTEM_FOLDERS = ['__MACOSX'];
const strictUtf8 = new TextDecoder('utf-8', { fatal: true });

export class ImportArchiveReader {
  static async read(
    file: UploadedImportFile | undefined,
  ): Promise<ImportArchiveContent> {
    if (!file) {
      throw new UnsupportedImportFileException();
    }
    if (file.size > IMPORT_MAX_ARCHIVE_SIZE_BYTES) {
      throw new ImportTooLargeException(
        `The file must not exceed ${IMPORT_MAX_ARCHIVE_SIZE_MB} MB`,
      );
    }

    const extension = posix.extname(file.originalname).toLowerCase();
    if (MARKDOWN_EXTENSIONS.includes(extension)) {
      return {
        files: [
          {
            path: ImportArchiveReader.safeName(file.originalname),
            data: file.buffer,
          },
        ],
        ignored: [],
        hiddenPaths: [],
      };
    }
    if (extension === '.zip') {
      return ImportArchiveReader.readZip(file.buffer);
    }
    throw new UnsupportedImportFileException();
  }

  private static async readZip(buffer: Buffer): Promise<ImportArchiveContent> {
    let zip: ZipFile;
    try {
      zip = await fromBufferPromise(buffer, {
        lazyEntries: true,
        decodeStrings: false,
        validateEntrySizes: true,
      });
    } catch {
      throw new InvalidImportArchiveException();
    }

    const content: ImportArchiveContent = {
      files: [],
      ignored: [],
      hiddenPaths: [],
    };
    let uncompressedSize = 0;
    try {
      for (
        let entry = await ImportArchiveReader.nextEntry(zip);
        entry !== null;
        entry = await ImportArchiveReader.nextEntry(zip)
      ) {
        const path = ImportArchiveReader.entryPath(entry);
        if (path.endsWith('/')) {
          continue;
        }
        if (ImportArchiveReader.isHidden(path)) {
          content.hiddenPaths.push(path);
          continue;
        }
        if (ImportArchiveReader.isSymlink(entry)) {
          content.ignored.push({ path, reason: 'symlink' });
          continue;
        }
        if (entry.isEncrypted() || !entry.canDecodeFileData()) {
          content.ignored.push({ path, reason: 'encrypted' });
          continue;
        }

        uncompressedSize += entry.uncompressedSize;
        ImportArchiveReader.assertUncompressedSize(uncompressedSize);
        content.files.push({
          path,
          data: await ImportArchiveReader.readEntry(zip, entry),
        });
      }
    } finally {
      zip.close();
    }
    return content;
  }

  private static nextEntry(zip: ZipFile): Promise<Entry | null> {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        zip.off('entry', onEntry);
        zip.off('end', onEnd);
        zip.off('error', onError);
      };
      const onEntry = (entry: Entry) => {
        cleanup();
        resolve(entry);
      };
      const onEnd = () => {
        cleanup();
        resolve(null);
      };
      const onError = () => {
        cleanup();
        reject(new InvalidImportArchiveException());
      };
      zip.on('entry', onEntry);
      zip.on('end', onEnd);
      zip.on('error', onError);
      zip.readEntry();
    });
  }

  private static async readEntry(zip: ZipFile, entry: Entry): Promise<Buffer> {
    const stream = await new Promise<Readable>((resolve, reject) => {
      zip.openReadStream(entry, (error, readStream) =>
        error
          ? reject(new InvalidImportArchiveException())
          : resolve(readStream),
      );
    });

    const chunks: Buffer[] = [];
    let size = 0;
    try {
      for await (const chunk of stream) {
        const data = chunk as Buffer;
        size += data.length;
        if (size > entry.uncompressedSize) {
          throw new InvalidImportArchiveException();
        }
        chunks.push(data);
      }
    } catch (error) {
      stream.destroy();
      throw error instanceof InvalidImportArchiveException
        ? error
        : new InvalidImportArchiveException();
    }
    return Buffer.concat(chunks, size);
  }

  private static assertUncompressedSize(size: number): void {
    if (size > IMPORT_MAX_UNCOMPRESSED_SIZE_BYTES) {
      throw new ImportTooLargeException(
        `The archive must not exceed ${IMPORT_MAX_UNCOMPRESSED_SIZE_MB} MB once uncompressed`,
      );
    }
  }

  private static entryPath(entry: Entry): string {
    const raw = entry.fileName as unknown as Buffer;
    const name = ImportArchiveReader.decodeName(
      raw,
      (entry.generalPurposeBitFlag & UTF8_NAME_FLAG) !== 0,
    ).replace(/\\/g, '/');
    if (
      name.startsWith('/') ||
      /^[a-zA-Z]:/.test(name) ||
      name.split('/').includes('..') ||
      name.includes('\0')
    ) {
      throw new UnsafeImportPathException(name);
    }
    return name.replace(/^(\.\/)+/, '');
  }

  private static decodeName(raw: Buffer, flaggedUtf8: boolean): string {
    if (flaggedUtf8) {
      return raw.toString('utf8');
    }
    try {
      return strictUtf8.decode(raw);
    } catch {
      return raw.toString('latin1');
    }
  }

  private static isHidden(path: string): boolean {
    return path
      .split('/')
      .some(
        (segment) =>
          segment.startsWith('.') || SYSTEM_FOLDERS.includes(segment),
      );
  }

  private static isSymlink(entry: Entry): boolean {
    return (
      ((entry.externalFileAttributes >>> 16) & FILE_TYPE_MASK) === SYMLINK_MODE
    );
  }

  private static safeName(filename: string): string {
    return posix.basename(filename.replace(/\\/g, '/'));
  }
}
