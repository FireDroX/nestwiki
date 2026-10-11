import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { streamZip } from './zip-stream.js';

function collect(stream: PassThrough): Promise<Buffer> {
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  return new Promise((resolve) =>
    stream.on('finish', () => resolve(Buffer.concat(chunks))),
  );
}

describe('streamZip', () => {
  it('writes a zip archive with every entry', async () => {
    const output = new PassThrough();
    const written = collect(output);

    await streamZip([{ name: 'guide.md', data: 'hello' }], output);

    const zip = await written;
    expect(zip.subarray(0, 2).toString()).toBe('PK');
    expect(zip.includes(Buffer.from('guide.md'))).toBe(true);
  });

  it('destroys the output instead of crashing when the archive fails', async () => {
    const output = new PassThrough();
    output.on('error', () => undefined);

    await streamZip([{ name: '', data: 'nameless entry' }], output);

    expect(output.destroyed).toBe(true);
  });

  it('stops archiving when the output closes early', async () => {
    const output = new PassThrough();
    const done = streamZip(
      [{ name: 'big.bin', data: Buffer.alloc(5 * 1024 * 1024) }],
      output,
    );

    output.destroy();

    await expect(done).resolves.toBeUndefined();
  });
});
