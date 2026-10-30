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
  IMPORT_MAX_NOTE_SIZE_BYTES,
  IMPORT_MAX_UNCOMPRESSED_SIZE_BYTES,
  IMPORT_MAX_UNCOMPRESSED_SIZE_MB,
  MAX_ATTACHMENT_SIZE_BYTES,
} from '../../common/variables.global.js';
import { attachmentMimeType, isMarkdownFile } from './import-file-types.js';
import { assertImportPathLimits } from './import-path-limits.js';

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

    const filename = ImportArchiveReader.uploadedFilename(file.originalname);
    if (isMarkdownFile(filename)) {
      if (file.size > IMPORT_MAX_NOTE_SIZE_BYTES) {
        throw new ImportTooLargeException(
          `A Markdown note must not exceed ${IMPORT_MAX_NOTE_SIZE_BYTES} bytes`,
        );
      }
      return {
        files: [{ path: filename, data: file.buffer }],
        ignored: [],
        hiddenPaths: [],
      };
    }
    if (posix.extname(filename).toLowerCase() === '.zip') {
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
        assertImportPathLimits(path);
        if (ImportArchiveReader.isSymlink(entry)) {
          content.ignored.push({ path, reason: 'symlink' });
          continue;
        }
        if (entry.isEncrypted() || !entry.canDecodeFileData()) {
          content.ignored.push({ path, reason: 'encrypted' });
          continue;
        }
        const skipReason = ImportArchiveReader.skipReason(path, entry);
        if (skipReason) {
          content.ignored.push({ path, reason: skipReason });
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

  private static skipReason(
    path: string,
    entry: Entry,
  ): IgnoredImportFileReason | null {
    const isNote = isMarkdownFile(path);
    if (!isNote && !attachmentMimeType(path)) {
      return 'unsupported_type';
    }
    const maxSize = isNote
      ? IMPORT_MAX_NOTE_SIZE_BYTES
      : MAX_ATTACHMENT_SIZE_BYTES;
    return entry.uncompressedSize > maxSize ? 'too_large' : null;
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

  private static uploadedFilename(originalname: string): string {
    const name = posix.basename(originalname.replace(/\\/g, '/'));
    if ([...name].some((character) => character.charCodeAt(0) > 0xff)) {
      return name;
    }
    try {
      return strictUtf8.decode(Buffer.from(name, 'latin1'));
    } catch {
      return name;
    }
  }
}
