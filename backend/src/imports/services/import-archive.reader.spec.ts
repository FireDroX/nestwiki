import { ZipArchive } from 'archiver';
import { describe, expect, it, vi } from 'vitest';
import { ImportTooLargeException } from '../../common/exceptions/imports/import-too-large.exception.js';
import { InvalidImportArchiveException } from '../../common/exceptions/imports/invalid-import-archive.exception.js';
import { UnsafeImportPathException } from '../../common/exceptions/imports/unsafe-import-path.exception.js';
import { UnsupportedImportFileException } from '../../common/exceptions/imports/unsupported-import-file.exception.js';
import { ImportArchiveReader } from './import-archive.reader.js';

vi.mock('../../common/variables.global.js', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../common/variables.global.js')
  >()),
  IMPORT_MAX_ARCHIVE_SIZE_BYTES: 64 * 1024,
  IMPORT_MAX_UNCOMPRESSED_SIZE_BYTES: 32 * 1024,
}));

async function buildZip(
  entries: Record<string, string | Buffer>,
  symlinks: Record<string, string> = {},
): Promise<Buffer> {
  const archive = new ZipArchive();
  const chunks: Buffer[] = [];
  archive.on('data', (chunk: Buffer) => chunks.push(chunk));
  const ended = new Promise((resolve) => archive.on('end', resolve));
  for (const [name, data] of Object.entries(entries)) {
    archive.append(data, { name });
  }
  for (const [name, target] of Object.entries(symlinks)) {
    archive.symlink(name, target);
  }
  await archive.finalize();
  await ended;
  return Buffer.concat(chunks);
}

function replaceAll(buffer: Buffer, from: string, to: string): Buffer {
  return Buffer.from(buffer.toString('latin1').split(from).join(to), 'latin1');
}

function upload(originalname: string, buffer: Buffer) {
  return { originalname, size: buffer.length, buffer };
}

describe('ImportArchiveReader', () => {
  it('reads a single Markdown file', async () => {
    const content = await ImportArchiveReader.read(
      upload('Ma note.md', Buffer.from('# Ma note')),
    );

    expect(content.files).toEqual([
      { path: 'Ma note.md', data: Buffer.from('# Ma note') },
    ]);
  });

  it('reads every file of a zip archive with UTF-8 names', async () => {
    const zip = await buildZip({
      'Projet/Été.md': '# Été',
      'Projet/image.png': Buffer.from([1, 2, 3]),
    });

    const content = await ImportArchiveReader.read(upload('vault.zip', zip));

    expect(content.files.map((file) => file.path)).toEqual([
      'Projet/Été.md',
      'Projet/image.png',
    ]);
    expect(content.files[1].data).toEqual(Buffer.from([1, 2, 3]));
  });

  it('skips hidden folders such as .obsidian and reports them', async () => {
    const zip = await buildZip({
      '.obsidian/app.json': '{}',
      '__MACOSX/._note.md': 'x',
      'note.md': '# Note',
    });

    const content = await ImportArchiveReader.read(upload('vault.zip', zip));

    expect(content.files.map((file) => file.path)).toEqual(['note.md']);
    expect(content.hiddenPaths).toEqual([
      '.obsidian/app.json',
      '__MACOSX/._note.md',
    ]);
  });

  it('ignores symbolic links', async () => {
    const zip = await buildZip(
      { 'note.md': '# Note' },
      { 'link.md': 'note.md' },
    );

    const content = await ImportArchiveReader.read(upload('vault.zip', zip));

    expect(content.files.map((file) => file.path)).toEqual(['note.md']);
    expect(content.ignored).toEqual([{ path: 'link.md', reason: 'symlink' }]);
  });

  it('rejects an entry escaping the archive with ..', async () => {
    const zip = replaceAll(
      await buildZip({ 'xx/evil.md': '# Evil' }),
      'xx/evil.md',
      '../evil.md',
    );

    await expect(
      ImportArchiveReader.read(upload('vault.zip', zip)),
    ).rejects.toThrow(UnsafeImportPathException);
  });

  it('rejects an entry with an absolute path', async () => {
    const zip = replaceAll(
      await buildZip({ 'Xabs.md': '# Abs' }),
      'Xabs.md',
      '/abs.md',
    );

    await expect(
      ImportArchiveReader.read(upload('vault.zip', zip)),
    ).rejects.toThrow(UnsafeImportPathException);
  });

  it('stops a zip bomb once the uncompressed size exceeds the limit', async () => {
    const zip = await buildZip({
      'a.md': Buffer.alloc(20 * 1024, 'a'),
      'b.md': Buffer.alloc(20 * 1024, 'b'),
    });

    expect(zip.length).toBeLessThan(32 * 1024);
    await expect(
      ImportArchiveReader.read(upload('vault.zip', zip)),
    ).rejects.toThrow(ImportTooLargeException);
  });

  it('rejects an entry whose real size exceeds its declared size', async () => {
    const zip = await buildZip({ 'bomb.md': Buffer.alloc(16 * 1024, 'a') });
    const centralDirectory = zip.lastIndexOf(
      Buffer.from([0x50, 0x4b, 0x01, 0x02]),
    );
    zip.writeUInt32LE(10, centralDirectory + 24);

    await expect(
      ImportArchiveReader.read(upload('vault.zip', zip)),
    ).rejects.toThrow(InvalidImportArchiveException);
  });

  it('rejects a file larger than the upload limit', async () => {
    await expect(
      ImportArchiveReader.read(upload('vault.zip', Buffer.alloc(65 * 1024))),
    ).rejects.toThrow(ImportTooLargeException);
  });

  it('rejects a corrupted archive', async () => {
    await expect(
      ImportArchiveReader.read(upload('vault.zip', Buffer.from('not a zip'))),
    ).rejects.toThrow(InvalidImportArchiveException);
  });

  it('rejects files that are neither .zip nor .md', async () => {
    await expect(
      ImportArchiveReader.read(upload('notes.pdf', Buffer.from('%PDF'))),
    ).rejects.toThrow(UnsupportedImportFileException);
    await expect(ImportArchiveReader.read(undefined)).rejects.toThrow(
      UnsupportedImportFileException,
    );
  });
});
