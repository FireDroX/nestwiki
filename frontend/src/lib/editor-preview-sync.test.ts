import { describe, expect, it } from 'vitest'
import {
  caretLineFromValue,
  findAnchorIndex,
  previewOffsetForLine,
  sourceLineAtOffset,
  type PreviewAnchor,
} from './editor-preview-sync'

const anchors: PreviewAnchor[] = [
  { line: 3, endLine: 3, top: 20, height: 40 },
  { line: 5, endLine: 8, top: 100, height: 200 },
  { line: 12, endLine: 12, top: 400, height: 30 },
]

describe('caretLineFromValue', () => {
  it('counts newlines before the caret', () => {
    expect(caretLineFromValue('a\nb\nc', 0)).toBe(1)
    expect(caretLineFromValue('a\nb\nc', 2)).toBe(2)
    expect(caretLineFromValue('a\nb\nc', 5)).toBe(3)
    expect(caretLineFromValue('a\nb', 99)).toBe(2)
  })
})

describe('findAnchorIndex', () => {
  it('returns the last index whose line is at most the target', () => {
    expect(findAnchorIndex([3, 5, 12], 2)).toBe(-1)
    expect(findAnchorIndex([3, 5, 12], 5)).toBe(1)
    expect(findAnchorIndex([3, 5, 12], 11)).toBe(1)
    expect(findAnchorIndex([3, 5, 12], 40)).toBe(2)
    expect(findAnchorIndex([], 1)).toBe(-1)
  })
})

describe('previewOffsetForLine', () => {
  it('returns 0 without anchors', () => {
    expect(previewOffsetForLine([], 10)).toBe(0)
  })

  it('interpolates from the top before the first anchor', () => {
    expect(previewOffsetForLine(anchors, 1)).toBe(0)
    expect(previewOffsetForLine(anchors, 2)).toBe(10)
  })

  it('returns the block top at its first line', () => {
    expect(previewOffsetForLine(anchors, 5)).toBe(100)
  })

  it('interpolates inside a multi-line block', () => {
    expect(previewOffsetForLine(anchors, 7)).toBe(200)
    expect(previewOffsetForLine(anchors, 6.5)).toBe(175)
  })

  it('interpolates across the gap between blocks', () => {
    expect(previewOffsetForLine(anchors, 4)).toBe(60)
    expect(previewOffsetForLine(anchors, 9)).toBe(300)
    expect(previewOffsetForLine(anchors, 10.5)).toBe(300 + 100 * 0.5)
  })

  it('stays at the end of the last block after it', () => {
    expect(previewOffsetForLine(anchors, 12)).toBe(400)
    expect(previewOffsetForLine(anchors, 50)).toBe(430)
  })
})

describe('sourceLineAtOffset', () => {
  const lineTops = [16, 36, 76, 96]

  it('maps offsets to fractional source lines', () => {
    expect(sourceLineAtOffset(lineTops, 0)).toBe(1)
    expect(sourceLineAtOffset(lineTops, 16)).toBe(1)
    expect(sourceLineAtOffset(lineTops, 26)).toBe(1.5)
    expect(sourceLineAtOffset(lineTops, 56)).toBe(2.5)
    expect(sourceLineAtOffset(lineTops, 500)).toBe(3)
  })

  it('returns line 1 without lines', () => {
    expect(sourceLineAtOffset([], 10)).toBe(1)
  })
})
