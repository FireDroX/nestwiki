import { describe, expect, it } from 'vitest';
import { findCodeRanges } from './markdown-code-ranges.js';

function codeOf(content: string): string[] {
  return findCodeRanges(content).map(({ start, end }) =>
    content.slice(start, end),
  );
}

function elapsedMs(run: () => unknown): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

describe('findCodeRanges', () => {
  it('finds fenced blocks from the opening line to the end of the closing line', () => {
    expect(codeOf('a\n```ts\nx\n```\nb')).toEqual(['```ts\nx\n```']);
    expect(codeOf('~~~\nx\n~~~~ end\nb')).toEqual(['~~~\nx\n~~~~ end']);
    expect(codeOf('  ```\n  x\n  ```')).toEqual(['  ```\n  x\n  ```']);
  });

  it('runs an unterminated fence to the end of the content', () => {
    expect(codeOf('a\n```\nx\n\ny')).toEqual(['```\nx\n\ny']);
  });

  it('closes a fence only with a fence of the same character, at least as long', () => {
    expect(codeOf('````\n```\n~~~~\n````\nb')).toEqual([
      '````\n```\n~~~~\n````',
    ]);
  });

  it('does not open a fence on the last line or with fewer than three characters', () => {
    expect(codeOf('```')).toEqual([]);
    expect(codeOf('``\nx\n``')).toEqual(['``\nx\n``']);
  });

  it('pairs a backtick run with the next run of the same length', () => {
    expect(codeOf('a `x` b `` y ` z `` c')).toEqual(['`x`', '`` y ` z ``']);
  });

  it('treats a run without a closer of its length as text', () => {
    expect(codeOf('``a` b')).toEqual([]);
    expect(codeOf('` a `` b `c`')).toEqual(['` a `` b `']);
  });

  it('never pairs inline code across a blank line', () => {
    expect(codeOf('`a\n\nb` `c`')).toEqual(['` `']);
    expect(codeOf('`a\n \t\nb`')).toEqual([]);
    expect(codeOf('`a\nb`')).toEqual(['`a\nb`']);
  });

  it('stays linear on adversarial backtick and fence sequences', () => {
    const inputs = [
      '`'.repeat(200_000),
      Array.from({ length: 600 }, (_, i) => '`'.repeat(i + 1)).join('a'),
      '`a'.repeat(100_000),
      '```\n'.repeat(50_000),
      `${' '.repeat(100_000)}\n`.repeat(2),
    ];
    for (const content of inputs) {
      expect(elapsedMs(() => findCodeRanges(content))).toBeLessThan(200);
    }
  });
});
