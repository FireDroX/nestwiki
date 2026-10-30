import { merge } from 'node-diff3';
import { describe, expect, it } from 'vitest';
import { MergeTooLargeException } from '../../common/exceptions/pages/merge-too-large.exception.js';
import { PageMergeService } from './page-merge.service.js';

function elapsedMs(run: () => unknown): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

describe('PageMergeService', () => {
  const service = new PageMergeService();

  it('merges disjoint line edits without conflict', () => {
    const base = 'Line 1\nLine 2\nLine 3';
    const mine = 'Line 1 edited by me\nLine 2\nLine 3';
    const theirs = 'Line 1\nLine 2\nLine 3 edited by them';

    const result = service.merge(base, mine, theirs);

    expect(result.conflict).toBe(false);
    expect(result.content).toBe(
      'Line 1 edited by me\nLine 2\nLine 3 edited by them',
    );
  });

  it('flags a conflict when both sides edit the same line', () => {
    const base = 'Line 1\nLine 2\nLine 3';
    const mine = 'Line 1\nLine 2 edited by me\nLine 3';
    const theirs = 'Line 1\nLine 2 edited by them\nLine 3';

    const result = service.merge(base, mine, theirs);

    expect(result.conflict).toBe(true);
    expect(result.content).toContain('<<<<<<<');
    expect(result.content).toContain('Line 2 edited by me');
    expect(result.content).toContain('=======');
    expect(result.content).toContain('Line 2 edited by them');
    expect(result.content).toContain('>>>>>>>');
  });

  it('returns the original content untouched when nothing changed', () => {
    const base = 'Line 1\nLine 2\nLine 3';

    const result = service.merge(base, base, base);

    expect(result.conflict).toBe(false);
    expect(result.content).toBe(base);
  });

  it('returns a single ok segment when nothing conflicts', () => {
    const base = 'Line 1\nLine 2\nLine 3';
    const mine = 'Line 1 edited by me\nLine 2\nLine 3';
    const theirs = 'Line 1\nLine 2\nLine 3 edited by them';

    const result = service.merge(base, mine, theirs);

    expect(result.segments).toEqual([
      {
        type: 'ok',
        lines: ['Line 1 edited by me', 'Line 2', 'Line 3 edited by them'],
      },
    ]);
  });

  it('splits a conflict into ok and conflict segments', () => {
    const base = 'Line 1\nLine 2\nLine 3';
    const mine = 'Line 1\nLine 2 edited by me\nLine 3';
    const theirs = 'Line 1\nLine 2 edited by them\nLine 3';

    const result = service.merge(base, mine, theirs);

    expect(result.segments).toEqual([
      { type: 'ok', lines: ['Line 1'] },
      {
        type: 'conflict',
        mine: ['Line 2 edited by me'],
        base: ['Line 2'],
        theirs: ['Line 2 edited by them'],
      },
      { type: 'ok', lines: ['Line 3'] },
    ]);
  });

  it('keeps several conflicts and conflicts at both ends', () => {
    const base = 'A\nB\nC\nD\nE';
    const mine = 'A1\nB\nC1\nD\nE1';
    const theirs = 'A2\nB\nC2\nD\nE2';

    const result = service.merge(base, mine, theirs);

    expect(result.segments.map((segment) => segment.type)).toEqual([
      'conflict',
      'ok',
      'conflict',
      'ok',
      'conflict',
    ]);
    expect(result.segments[0]).toEqual({
      type: 'conflict',
      mine: ['A1'],
      base: ['A'],
      theirs: ['A2'],
    });
    expect(result.segments[4]).toEqual({
      type: 'conflict',
      mine: ['E1'],
      base: ['E'],
      theirs: ['E2'],
    });
  });

  it('represents a deletion on one side as an empty side', () => {
    const base = 'Line 1\nLine 2\nLine 3';
    const mine = 'Line 1\nLine 3';
    const theirs = 'Line 1\nLine 2 edited by them\nLine 3';

    const result = service.merge(base, mine, theirs);

    expect(result.conflict).toBe(true);
    expect(result.segments).toContainEqual({
      type: 'conflict',
      mine: [],
      base: ['Line 2'],
      theirs: ['Line 2 edited by them'],
    });
  });

  it.each([
    [
      'Line 1\nLine 2\nLine 3',
      'Line 1\nMine\nLine 3',
      'Line 1\nTheirs\nLine 3',
    ],
    ['A\nB\nC\n', 'A\nB mine\nC\nD mine\n', 'A\nB theirs\nC\n'],
    ['A\nB', '', 'A\nB\nC'],
    ['', 'Mine only', 'Theirs only'],
    ['A\nB\nC', 'A\nC', 'A\nB changed\nC'],
  ])(
    'produces the same marked content as a plain three-way merge (case %#)',
    (base, mine, theirs) => {
      const expected = merge(mine, base, theirs, { stringSeparator: '\n' });

      const result = service.merge(base, mine, theirs);

      expect(result.conflict).toBe(expected.conflict);
      expect(result.content).toBe(expected.result.join('\n'));
    },
  );

  it('merges thousands of identical lines quickly', () => {
    const base = Array(3000).fill('x').join('\n');
    const mine = `top\n${base}`;
    const theirs = `${base}\nbottom`;

    expect(elapsedMs(() => service.merge(base, mine, theirs))).toBeLessThan(
      500,
    );
    expect(service.merge(base, mine, theirs)).toEqual(
      expect.objectContaining({
        conflict: false,
        content: `top\n${base}\nbottom`,
      }),
    );
  });

  it('merges a long page with many blank lines quickly', () => {
    const lines = Array.from({ length: 20_000 }, (_, i) =>
      i % 3 === 0 ? '' : `line ${i}`,
    );
    const base = lines.join('\n');
    const mine = ['mine', ...lines].join('\n');
    const theirs = [...lines, 'theirs'].join('\n');

    expect(elapsedMs(() => service.merge(base, mine, theirs))).toBeLessThan(
      500,
    );
  });

  it('refuses to merge sides that rewrote too much of the page', () => {
    const base = Array(20_000).fill('a').join('\n');
    const mine = Array(20_000).fill('b').join('\n');
    let thrown: unknown;

    const elapsed = elapsedMs(() => {
      try {
        service.merge(base, mine, base);
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBeInstanceOf(MergeTooLargeException);
    expect(elapsed).toBeLessThan(500);
  });
});
