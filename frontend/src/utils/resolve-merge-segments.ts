import type { MergeSegment } from '#api/pages'

export type ConflictChoice = 'mine' | 'theirs' | 'both'

function linesFor(segment: MergeSegment, choice: ConflictChoice | undefined): string[] | null {
  if (segment.type === 'ok') {
    return segment.lines
  }
  if (choice === 'mine') {
    return segment.mine
  }
  if (choice === 'theirs') {
    return segment.theirs
  }
  if (choice === 'both') {
    return [...segment.mine, ...segment.theirs]
  }
  return null
}

export function resolveMergeSegments(
  segments: MergeSegment[],
  choices: Partial<Record<number, ConflictChoice>>,
): string | null {
  const lines: string[] = []
  for (const [index, segment] of segments.entries()) {
    const resolved = linesFor(segment, choices[index])
    if (resolved === null) {
      return null
    }
    lines.push(...resolved)
  }
  return lines.join('\n')
}
