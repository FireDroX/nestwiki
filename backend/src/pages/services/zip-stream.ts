import { ZipArchive } from 'archiver';
import { once } from 'node:events';
import type { Writable } from 'node:stream';

export interface ZipEntry {
  name: string;
  data: string | Buffer | (() => Promise<Buffer | null>);
}

export async function streamZip(
  entries: ZipEntry[],
  output: Writable,
): Promise<void> {
  const archive = new ZipArchive();
  let stopped = false;
  const finished = new Promise<void>((resolve) => {
    archive.on('error', (error) => {
      stopped = true;
      output.destroy(error);
      resolve();
    });
    output.on('close', () => {
      stopped = true;
      archive.abort();
      resolve();
    });
    output.on('finish', () => resolve());
  });

  archive.pipe(output);
  for (const entry of entries) {
    if (stopped) {
      break;
    }
    const data =
      typeof entry.data === 'function' ? await entry.data() : entry.data;
    if (stopped || data === null) {
      continue;
    }
    const appended = once(archive, 'entry').catch(() => undefined);
    archive.append(data, { name: entry.name });
    await Promise.race([appended, finished]);
  }
  if (!stopped) {
    void archive.finalize().catch(() => undefined);
  }
  await finished;
}
