import { describe, expect, it } from 'vitest';
import { PageMergeService } from './page-merge.service.js';

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
});
