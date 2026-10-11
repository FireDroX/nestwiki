import { Injectable } from '@nestjs/common';
import { diff3Merge, merge } from 'node-diff3';

export type MergeSegment =
  | { type: 'ok'; lines: string[] }
  | { type: 'conflict'; mine: string[]; base: string[]; theirs: string[] };

export interface PageMergeResult {
  conflict: boolean;
  content: string;
  segments: MergeSegment[];
}

const LINE_SEPARATOR = '\n';

@Injectable()
export class PageMergeService {
  merge(base: string, mine: string, theirs: string): PageMergeResult {
    const result = merge(mine, base, theirs, {
      stringSeparator: LINE_SEPARATOR,
    });
    return {
      conflict: result.conflict,
      content: result.result.join(LINE_SEPARATOR),
      segments: PageMergeService.toSegments(base, mine, theirs),
    };
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
