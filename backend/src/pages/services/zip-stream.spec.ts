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

  it('reads lazy entries one at a time and skips the ones that return nothing', async () => {
    const output = new PassThrough();
    const written = collect(output);
    const events: string[] = [];
    const lazy = (name: string, value: string | null) => () => {
      events.push(`read ${name}`);
      return new Promise<Buffer | null>((resolve) =>
        setTimeout(() => {
          events.push(`done ${name}`);
          resolve(value === null ? null : Buffer.from(value));
        }, 5),
      );
    };

    await streamZip(
      [
        { name: 'a.png', data: lazy('a', 'A') },
        { name: 'missing.png', data: lazy('missing', null) },
        { name: 'b.png', data: lazy('b', 'B') },
      ],
      output,
    );

    expect(events).toEqual([
      'read a',
      'done a',
      'read missing',
      'done missing',
      'read b',
      'done b',
    ]);
    const zip = await written;
    expect(zip.includes(Buffer.from('a.png'))).toBe(true);
    expect(zip.includes(Buffer.from('missing.png'))).toBe(false);
  });

  it('stops reading entries once the output is closed', async () => {
    const output = new PassThrough();
    const reads: string[] = [];
    const lazy = (name: string) => () => {
      reads.push(name);
      if (name === 'first') {
        output.destroy();
      }
      return Promise.resolve(Buffer.from(name));
    };

    await streamZip(
      [
        { name: 'first.png', data: lazy('first') },
        { name: 'second.png', data: lazy('second') },
      ],
      output,
    );

    expect(reads).toEqual(['first']);
  });
});
