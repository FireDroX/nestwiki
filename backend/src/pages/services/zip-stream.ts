import { ZipArchive } from 'archiver';
import type { Writable } from 'node:stream';

export interface ZipEntry {
  name: string;
  data: string | Buffer;
}

export function streamZip(
  entries: ZipEntry[],
  output: Writable,
): Promise<void> {
  const archive = new ZipArchive();

  return new Promise((resolve) => {
    archive.on('error', (error) => {
      output.destroy(error);
      resolve();
    });
    output.on('close', () => {
      archive.abort();
      resolve();
    });
    output.on('finish', () => resolve());

    archive.pipe(output);
    for (const entry of entries) {
      archive.append(entry.data, { name: entry.name });
    }
    void archive.finalize().catch(() => undefined);
  });
}
