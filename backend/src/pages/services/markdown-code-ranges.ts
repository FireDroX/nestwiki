export interface CodeRange {
  start: number;
  end: number;
}

const BACKTICK = '`';
const TILDE = '~';
const MIN_FENCE_LENGTH = 3;

export function findCodeRanges(content: string): CodeRange[] {
  const inlineSpans = new InlineCodeSpans(content);
  const ranges: CodeRange[] = [];
  let index = 0;
  while (index < content.length) {
    const fenceEnd = isLineStart(content, index)
      ? fencedBlockEnd(content, index)
      : null;
    if (fenceEnd !== null) {
      ranges.push({ start: index, end: fenceEnd });
      index = fenceEnd;
    } else if (content[index] === BACKTICK) {
      const runLength = countRepeated(content, index, BACKTICK);
      const closer = inlineSpans.closerOf(index, runLength);
      const end = closer === null ? null : closer + runLength;
      if (end !== null) {
        ranges.push({ start: index, end });
      }
      index = end ?? index + runLength;
    } else {
      index += 1;
    }
  }
  return ranges;
}

function isLineStart(content: string, index: number): boolean {
  return index === 0 || content[index - 1] === '\n';
}

function skipBlanks(content: string, index: number): number {
  let cursor = index;
  while (content[cursor] === ' ' || content[cursor] === '\t') {
    cursor += 1;
  }
  return cursor;
}

function countRepeated(content: string, index: number, char: string): number {
  let cursor = index;
  while (content[cursor] === char) {
    cursor += 1;
  }
  return cursor - index;
}

function lineEnd(content: string, index: number): number {
  const newline = content.indexOf('\n', index);
  return newline === -1 ? content.length : newline;
}

function fencedBlockEnd(content: string, lineStart: number): number | null {
  const fenceStart = skipBlanks(content, lineStart);
  const fenceChar = content[fenceStart];
  if (fenceChar !== BACKTICK && fenceChar !== TILDE) {
    return null;
  }
  const fenceLength = countRepeated(content, fenceStart, fenceChar);
  if (fenceLength < MIN_FENCE_LENGTH) {
    return null;
  }
  const openingEnd = lineEnd(content, fenceStart + fenceLength);
  if (openingEnd === content.length) {
    return null;
  }
  const fence = fenceChar.repeat(fenceLength);
  let cursor = openingEnd + 1;
  while (cursor < content.length) {
    const end = lineEnd(content, cursor);
    if (content.startsWith(fence, skipBlanks(content, cursor))) {
      return end;
    }
    cursor = end + 1;
  }
  return content.length;
}

class InlineCodeSpans {
  private readonly runStartsByLength = new Map<number, number[]>();
  private readonly runCursors = new Map<number, number>();
  private readonly blankLineStarts: number[] = [];
  private blankLineCursor = 0;

  constructor(private readonly content: string) {
    this.indexBacktickRuns();
    this.indexBlankLines();
  }

  closerOf(opener: number, runLength: number): number | null {
    const starts = this.runStartsByLength.get(runLength) ?? [];
    let cursor = this.runCursors.get(runLength) ?? 0;
    while (cursor < starts.length && starts[cursor] <= opener) {
      cursor += 1;
    }
    this.runCursors.set(runLength, cursor);
    const closer = starts[cursor];
    if (
      closer === undefined ||
      closer >= this.paragraphEnd(opener + runLength)
    ) {
      return null;
    }
    return closer;
  }

  private paragraphEnd(from: number): number {
    while (
      this.blankLineCursor < this.blankLineStarts.length &&
      this.blankLineStarts[this.blankLineCursor] < from
    ) {
      this.blankLineCursor += 1;
    }
    return this.blankLineStarts[this.blankLineCursor] ?? this.content.length;
  }

  private indexBacktickRuns(): void {
    let index = this.content.indexOf(BACKTICK);
    while (index !== -1) {
      const runLength = countRepeated(this.content, index, BACKTICK);
      const starts = this.runStartsByLength.get(runLength) ?? [];
      starts.push(index);
      this.runStartsByLength.set(runLength, starts);
      index = this.content.indexOf(BACKTICK, index + runLength);
    }
  }

  private indexBlankLines(): void {
    let newline = this.content.indexOf('\n');
    while (newline !== -1) {
      const next = skipBlanks(this.content, newline + 1);
      if (this.content[next] === '\n') {
        this.blankLineStarts.push(newline);
      }
      newline = this.content.indexOf('\n', newline + 1);
    }
  }
}
