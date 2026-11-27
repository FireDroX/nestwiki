import { SOURCE_LINE_ATTRIBUTE, SOURCE_LINE_END_ATTRIBUTE } from '#lib/markdown-source-lines'

export interface PreviewAnchor {
  line: number
  endLine: number
  top: number
  height: number
}

export interface AnchorElement {
  element: HTMLElement
  line: number
  endLine: number
}

export function caretLineFromValue(value: string, selectionStart: number): number {
  let line = 1
  const end = Math.min(selectionStart, value.length)
  for (let index = value.indexOf('\n'); index !== -1 && index < end; index = value.indexOf('\n', index + 1)) {
    line += 1
  }
  return line
}

export function findAnchorIndex(lines: number[], line: number): number {
  let low = 0
  let high = lines.length - 1
  let found = -1
  while (low <= high) {
    const middle = (low + high) >> 1
    if (lines[middle] <= line) {
      found = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  return found
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function previewOffsetForLine(anchors: PreviewAnchor[], line: number): number {
  if (anchors.length === 0) {
    return 0
  }
  const index = findAnchorIndex(
    anchors.map((anchor) => anchor.line),
    line,
  )
  if (index === -1) {
    const [first] = anchors
    return first.top * clamp01((line - 1) / Math.max(first.line - 1, 1))
  }

  const anchor = anchors[index]
  const blockSpan = anchor.endLine - anchor.line + 1
  if (line < anchor.line + blockSpan) {
    return anchor.top + anchor.height * ((line - anchor.line) / blockSpan)
  }

  const gapStart = anchor.top + anchor.height
  const next = anchors[index + 1]
  if (!next) {
    return gapStart
  }
  const gapEnd = Math.max(next.top, gapStart)
  const gapFirstLine = anchor.endLine + 1
  const fraction = clamp01((line - gapFirstLine) / Math.max(next.line - gapFirstLine, 1))
  return gapStart + (gapEnd - gapStart) * fraction
}

export function sourceLineAtOffset(lineTops: number[], offset: number): number {
  const lineCount = lineTops.length - 1
  if (lineCount < 1) {
    return 1
  }
  const index = findAnchorIndex(lineTops, offset)
  if (index === -1) {
    return 1
  }
  if (index >= lineCount) {
    return lineCount
  }
  const height = lineTops[index + 1] - lineTops[index]
  const fraction = height > 0 ? (offset - lineTops[index]) / height : 0
  return index + 1 + fraction
}

export function collectAnchorElements(container: HTMLElement): AnchorElement[] {
  const entries: AnchorElement[] = []
  container.querySelectorAll<HTMLElement>(`[${SOURCE_LINE_ATTRIBUTE}]`).forEach((element) => {
    const line = Number(element.getAttribute(SOURCE_LINE_ATTRIBUTE))
    const endLine = Number(element.getAttribute(SOURCE_LINE_END_ATTRIBUTE) ?? line)
    if (Number.isFinite(line)) {
      entries.push({ element, line, endLine: Number.isFinite(endLine) ? endLine : line })
    }
  })
  return entries.sort((a, b) => a.line - b.line)
}

export function measureAnchors(container: HTMLElement, entries: AnchorElement[]): PreviewAnchor[] {
  const containerTop = container.getBoundingClientRect().top
  return entries.map(({ element, line, endLine }) => {
    const rect = element.getBoundingClientRect()
    return { line, endLine, top: rect.top - containerTop + container.scrollTop, height: rect.height }
  })
}
