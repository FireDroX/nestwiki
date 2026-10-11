import { Injectable } from '@nestjs/common';
import { diff3Merge } from 'node-diff3';

export type MergeSegment =
  | { type: 'ok'; lines: string[] }
  | { type: 'conflict'; mine: string[]; base: string[]; theirs: string[] };

export interface PageMergeResult {
  conflict: boolean;
  content: string;
  segments: MergeSegment[];
}

const LINE_SEPARATOR = '\n';
const MINE_MARKER = '<<<<<<<';
const SEPARATOR_MARKER = '=======';
const THEIRS_MARKER = '>>>>>>>';

@Injectable()
export class PageMergeService {
  merge(base: string, mine: string, theirs: string): PageMergeResult {
    const segments = PageMergeService.toSegments(base, mine, theirs);
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
    base: string,
    mine: string,
    theirs: string,
  ): MergeSegment[] {
    return diff3Merge(mine, base, theirs, {
      stringSeparator: LINE_SEPARATOR,
    }).map((block): MergeSegment =>
      block.conflict
        ? {
            type: 'conflict',
            mine: block.conflict.a,
            base: block.conflict.o,
            theirs: block.conflict.b,
          }
        : { type: 'ok', lines: block.ok ?? [] },
    );
  }
}
