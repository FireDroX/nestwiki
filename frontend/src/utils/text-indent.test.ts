import { describe, expect, it } from 'vitest'
import { applyTextEdit, indentSelection, outdentSelection } from './text-indent'

function indent(value: string, start: number, end = start) {
  const edit = indentSelection(value, start, end)
  return { value: applyTextEdit(value, edit), start: edit.selectionStart, end: edit.selectionEnd }
}

function outdent(value: string, start: number, end = start) {
  const edit = outdentSelection(value, start, end)
  return edit && { value: applyTextEdit(value, edit), start: edit.selectionStart, end: edit.selectionEnd }
}

describe('indentSelection', () => {
  it('inserts two spaces at the caret', () => {
    expect(indent('hello', 2)).toEqual({ value: 'he  llo', start: 4, end: 4 })
  })

  it('indents an empty document', () => {
    expect(indent('', 0)).toEqual({ value: '  ', start: 2, end: 2 })
  })

  it('indents every touched line and keeps the selection on the same lines', () => {
    expect(indent('abc\ndef\nghi', 2, 9)).toEqual({ value: '  abc\n  def\n  ghi', start: 4, end: 15 })
  })

  it('keeps a selection starting at a line start on that line start', () => {
    expect(indent('abc\ndef', 0, 5)).toEqual({ value: '  abc\n  def', start: 0, end: 9 })
  })

  it('excludes the last line when the selection ends at its column 0', () => {
    expect(indent('abc\ndef\nghi', 0, 8)).toEqual({ value: '  abc\n  def\nghi', start: 0, end: 12 })
  })

  it('skips empty lines when several lines are touched', () => {
    expect(indent('a\n\nb', 0, 4).value).toBe('  a\n\n  b')
  })

  it('indents a single empty line when selected alone', () => {
    expect(indent('a\n\nb', 2, 3).value).toBe('a\n  \nb')
  })
})

describe('outdentSelection', () => {
  it.each([
    ['    x', '  x'],
    [' x', 'x'],
    ['  x', 'x'],
  ])('removes up to two leading spaces from %j', (input, expected) => {
    expect(outdent(input, input.length)?.value).toBe(expected)
  })

  it('returns null when there is nothing to remove', () => {
    expect(outdent('x', 1)).toBeNull()
  })

  it('outdents each selected line independently', () => {
    expect(outdent('    a\n b\nc\n  d', 0, 14)).toEqual({
      value: '  a\nb\nc\nd',
      start: 0,
      end: 9,
    })
  })

  it('clamps a caret inside the removed spaces to the line start', () => {
    expect(outdent('a\n    b', 4)).toEqual({ value: 'a\n  b', start: 2, end: 2 })
  })
})

describe('list items', () => {
  it.each(['- item', '* item', '1. item', '- [ ] item'])('nests and un-nests %j', (item) => {
    const nested = indent(item, item.length)
    expect(nested).toEqual({ value: `  ${item}`, start: item.length + 2, end: item.length + 2 })
    const restored = outdent(nested.value, nested.start)
    expect(restored).toEqual({ value: item, start: item.length, end: item.length })
  })

  it('nests from the middle of a list item at the line start', () => {
    expect(indent('- a\n- bc', 6).value).toBe('- a\n  - bc')
  })
})
