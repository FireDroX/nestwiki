import { Injectable } from '@nestjs/common';
import { diffArrays } from 'diff';
import { MergeTooLargeException } from '../../common/exceptions/pages/merge-too-large.exception.js';
import {
  MERGE_DIFF_TIMEOUT_MS,
  MERGE_MAX_EDIT_LENGTH,
} from '../../common/variables.global.js';

export type MergeSegment =
  | { type: 'ok'; lines: string[] }
  | { type: 'conflict'; mine: string[]; base: string[]; theirs: string[] };

export interface PageMergeResult {
  conflict: boolean;
  content: string;
  segments: MergeSegment[];
}

type MergeSide = 'mine' | 'theirs';

interface Hunk {
  side: MergeSide;
  baseStart: number;
  baseEnd: number;
  sideStart: number;
  sideEnd: number;
}

const LINE_SEPARATOR = '\n';
const MINE_MARKER = '<<<<<<<';
const SEPARATOR_MARKER = '=======';
const THEIRS_MARKER = '>>>>>>>';

@Injectable()
export class PageMergeService {
  merge(base: string, mine: string, theirs: string): PageMergeResult {
    const segments = PageMergeService.toSegments(base.split(LINE_SEPARATOR), {
      mine: mine.split(LINE_SEPARATOR),
      theirs: theirs.split(LINE_SEPARATOR),
    });
    return {
      conflict: segments.some((segment) => segment.type === 'conflict'),
      content: segments
        .flatMap((segment) => PageMergeService.toMarkedLines(segment))
        .join(LINE_SEPARATOR),
      segments,
    };
  }

  private static toMarkedLines(segment: MergeSegment): string[] {
    if (segment.type === 'ok') {
      return segment.lines;
    }
    return [
      MINE_MARKER,
      ...segment.mine,
      SEPARATOR_MARKER,
      ...segment.theirs,
      THEIRS_MARKER,
    ];
  }

  private static toSegments(
    base: string[],
    sides: Record<MergeSide, string[]>,
  ): MergeSegment[] {
    const hunks = [
      ...PageMergeService.hunksOf(base, sides.mine, 'mine'),
      ...PageMergeService.hunksOf(base, sides.theirs, 'theirs'),
    ].sort((left, right) => left.baseStart - right.baseStart);

    const segments: MergeSegment[] = [];
    let okLines: string[] = [];
    let baseCursor = 0;
    let index = 0;
    while (index < hunks.length) {
      const region = [hunks[index]];
      const regionStart = hunks[index].baseStart;
      let regionEnd = hunks[index].baseEnd;
      index += 1;
      while (index < hunks.length && hunks[index].baseStart <= regionEnd) {
        regionEnd = Math.max(regionEnd, hunks[index].baseEnd);
        region.push(hunks[index]);
        index += 1;
      }

      okLines.push(...base.slice(baseCursor, regionStart));
      baseCursor = regionEnd;
      if (region.length === 1) {
        const [hunk] = region;
        okLines.push(...sides[hunk.side].slice(hunk.sideStart, hunk.sideEnd));
        continue;
      }

      const regionBase = base.slice(regionStart, regionEnd);
      const [mine, theirs] = (['mine', 'theirs'] as const).map((side) =>
        PageMergeService.sideLines(
          region.filter((hunk) => hunk.side === side),
          sides[side],
          regionBase,
          regionStart,
        ),
      );
      if (PageMergeService.sameLines(mine, theirs)) {
        okLines.push(...mine);
        continue;
      }
      if (okLines.length > 0) {
        segments.push({ type: 'ok', lines: okLines });
        okLines = [];
      }
      segments.push({
        type: 'conflict',
        mine,
        base: regionBase,
        theirs,
      });
    }

    okLines.push(...base.slice(baseCursor));
    if (okLines.length > 0) {
      segments.push({ type: 'ok', lines: okLines });
    }
    return segments;
  }

  private static hunksOf(
    base: string[],
    sideLines: string[],
    side: MergeSide,
  ): Hunk[] {
    const changes = diffArrays(base, sideLines, {
      maxEditLength: MERGE_MAX_EDIT_LENGTH,
      timeout: MERGE_DIFF_TIMEOUT_MS,
    });
    if (!changes) {
      throw new MergeTooLargeException();
    }

    const hunks: Hunk[] = [];
    let current: Hunk | null = null;
    let baseIndex = 0;
    let sideIndex = 0;
    for (const change of changes) {
      const count = change.value.length;
      if (!change.added && !change.removed) {
        current = null;
        baseIndex += count;
        sideIndex += count;
        continue;
      }
      if (!current) {
        current = {
          side,
          baseStart: baseIndex,
          baseEnd: baseIndex,
          sideStart: sideIndex,
          sideEnd: sideIndex,
        };
        hunks.push(current);
      }
      if (change.removed) {
        baseIndex += count;
        current.baseEnd = baseIndex;
      } else {
        sideIndex += count;
        current.sideEnd = sideIndex;
      }
    }
    return hunks;
  }

  private static sideLines(
    sideHunks: Hunk[],
    lines: string[],
    regionBase: string[],
    regionStart: number,
  ): string[] {
    const first = sideHunks[0];
    const last = sideHunks[sideHunks.length - 1];
    if (!first) {
      return regionBase;
    }
    const regionEnd = regionStart + regionBase.length;
    return lines.slice(
      first.sideStart - (first.baseStart - regionStart),
      last.sideEnd + (regionEnd - last.baseEnd),
    );
  }

  private static sameLines(left: string[], right: string[]): boolean {
    return (
      left.length === right.length &&
      left.every((line, index) => line === right[index])
    );
  }
}
