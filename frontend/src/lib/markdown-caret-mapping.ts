import { findAnchorIndex } from '#lib/editor-preview-sync'

const ALIGN_WINDOW = 8
const FENCE_PATTERN = /^\s*(```|~~~)/
const LINE_PREFIX_PATTERNS = [
  /^\s+/,
  /^>\s?/,
  /^([-*+]|\d+[.)])\s+/,
  /^\[[ xX]\]\s+/,
  /^#{1,6}\s+/,
  /^\[![A-Za-z]+\]\s*/,
  /^\|\s*/,
]
const WHITESPACE = /\s/

export interface CaretPosition {
  line: number
  column: number
}

export interface RenderedMatch {
  segment: number
  offset: number
}

export function caretPositionFromValue(value: string, selectionStart: number): CaretPosition {
  const end = Math.min(selectionStart, value.length)
  let line = 1
  let lineStart = 0
  for (let index = value.indexOf('\n'); index !== -1 && index < end; index = value.indexOf('\n', index + 1)) {
    line += 1
    lineStart = index + 1
  }
  return { line, column: end - lineStart }
}

export function findContainingAnchorIndex(entries: { line: number; endLine: number }[], line: number): number {
  const last = findAnchorIndex(
    entries.map((entry) => entry.line),
    line,
  )
  for (let index = last; index >= 0; index -= 1) {
    if (entries[index].endLine >= line) {
      return index
    }
  }
  return -1
}

function offsetOfLine(value: string, fromOffset: number, linesToSkip: number): number {
  let offset = fromOffset
  for (let skipped = 0; skipped < linesToSkip; skipped += 1) {
    const newline = value.indexOf('\n', offset)
    if (newline === -1) {
      return value.length
    }
    offset = newline + 1
  }
  return offset
}

export function blockSourceSlice(value: string, startLine: number, line: number, column: number): string {
  const start = offsetOfLine(value, 0, startLine - 1)
  const lineStart = offsetOfLine(value, start, line - startLine)
  const lineEnd = value.indexOf('\n', lineStart)
  const limit = lineEnd === -1 ? value.length : lineEnd
  return value.slice(start, Math.min(lineStart + column, limit))
}

function stripLinePrefixes(line: string): string {
  if (/^\s*\|/.test(line)) {
    return line.replace(/\|/g, '')
  }
  let result = line
  let changed = true
  while (changed) {
    changed = false
    for (const pattern of LINE_PREFIX_PATTERNS) {
      const next = result.replace(pattern, '')
      if (next !== result) {
        result = next
        changed = true
      }
    }
  }
  return result
}

function stripInline(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/!\[[^\]]*\]\([^)]*$/, '')
    .replace(/\[\^([^\]]*)\]/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*$/, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/\[([^\]]*)$/, '$1')
    .replace(/<(https?:[^>]*)>/g, '$1')
    .replace(/<\/?[a-zA-Z][^>]*>?/g, '')
    .replace(/[`*~$]/g, '')
    .replace(/(^|[^\p{L}\p{N}_])_+/gu, '$1')
    .replace(/_+(?=$|[^\p{L}\p{N}_])/gu, '')
    .replace(/\\([\\`*_{}[\]()#+\-.!|~<>$])/g, '$1')
}

export function visibleSourceText(slice: string): string {
  const lines = slice.split('\n')
  if (FENCE_PATTERN.test(lines[0])) {
    return lines.filter((line) => !FENCE_PATTERN.test(line)).join('\n')
  }
  return stripInline(lines.map(stripLinePrefixes).join('\n'))
}

interface RenderedChar {
  segment: number
  end: number
  char: string
}

function flattenRendered(segments: string[]): RenderedChar[] {
  const flat: RenderedChar[] = []
  segments.forEach((text, segment) => {
    for (let index = 0; index < text.length; index += 1) {
      if (!WHITESPACE.test(text[index])) {
        flat.push({ segment, end: index + 1, char: text[index] })
      }
    }
  })
  return flat
}

function advancePastWhitespace(segments: string[], match: RenderedMatch): RenderedMatch {
  const current = segments[match.segment]
  if (match.offset < current.length) {
    return WHITESPACE.test(current[match.offset]) ? { ...match, offset: match.offset + 1 } : match
  }
  const next = segments[match.segment + 1]
  return next !== undefined && next.length > 0 && WHITESPACE.test(next[0]) ? { segment: match.segment + 1, offset: 1 } : match
}

export function alignVisibleText(segments: string[], visible: string): RenderedMatch | null {
  const flat = flattenRendered(segments)
  if (flat.length === 0) {
    return null
  }
  const wanted = Array.from(visible).filter((char) => !WHITESPACE.test(char))
  if (wanted.length === 0) {
    return { segment: flat[0].segment, offset: flat[0].end - 1 }
  }

  let cursor = 0
  let lastMatched = -1
  let misses = 0
  for (const char of wanted) {
    const limit = Math.min(cursor + ALIGN_WINDOW, flat.length)
    let found = -1
    for (let index = cursor; index < limit; index += 1) {
      if (flat[index].char === char) {
        found = index
        break
      }
    }
    if (found === -1) {
      misses += 1
    } else {
      cursor = found + 1
      lastMatched = found
    }
  }
  if (lastMatched === -1 || misses > Math.max(2, Math.ceil(wanted.length * 0.25))) {
    return null
  }

  const match = { segment: flat[lastMatched].segment, offset: flat[lastMatched].end }
  return WHITESPACE.test(visible[visible.length - 1]) ? advancePastWhitespace(segments, match) : match
}
