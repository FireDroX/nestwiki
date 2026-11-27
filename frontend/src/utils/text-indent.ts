export const INDENT_UNIT = '  '

const LIST_ITEM_REGEX = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/

export interface TextEdit {
  start: number
  end: number
  text: string
  selectionStart: number
  selectionEnd: number
}

interface Block {
  start: number
  end: number
  lines: string[]
}

export function applyTextEdit(value: string, edit: TextEdit): string {
  return value.slice(0, edit.start) + edit.text + value.slice(edit.end)
}

function lineStartOf(value: string, index: number): number {
  return index === 0 ? 0 : value.lastIndexOf('\n', index - 1) + 1
}

function lineEndOf(value: string, index: number): number {
  const end = value.indexOf('\n', index)
  return end === -1 ? value.length : end
}

function touchedBlock(value: string, selectionStart: number, selectionEnd: number): Block {
  const start = lineStartOf(value, selectionStart)
  const endsAtLineStart =
    selectionEnd > selectionStart && selectionEnd === lineStartOf(value, selectionEnd)
  const lastIndex = endsAtLineStart ? selectionEnd - 1 : selectionEnd
  const end = lineEndOf(value, lastIndex)
  return { start, end, lines: value.slice(start, end).split('\n') }
}

function shiftAt(block: Block, position: number, deltas: number[], capped: boolean): number {
  let lineStart = block.start
  let shift = 0
  block.lines.forEach((line, index) => {
    const reach = Math.max(0, position - lineStart)
    shift += capped ? Math.min(deltas[index], reach) : reach > 0 ? deltas[index] : 0
    lineStart += line.length + 1
  })
  return shift
}

function rebuild(
  block: Block,
  lines: string[],
  deltas: number[],
  selectionStart: number,
  selectionEnd: number,
  capped: boolean,
): TextEdit {
  const sign = capped ? -1 : 1
  return {
    start: block.start,
    end: block.end,
    text: lines.join('\n'),
    selectionStart: selectionStart + sign * shiftAt(block, selectionStart, deltas, capped),
    selectionEnd: selectionEnd + sign * shiftAt(block, selectionEnd, deltas, capped),
  }
}

export function indentSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TextEdit {
  if (selectionStart === selectionEnd) {
    const lineStart = lineStartOf(value, selectionStart)
    const line = value.slice(lineStart, lineEndOf(value, selectionStart))
    const at = LIST_ITEM_REGEX.test(line) ? lineStart : selectionStart
    return {
      start: at,
      end: at,
      text: INDENT_UNIT,
      selectionStart: selectionStart + INDENT_UNIT.length,
      selectionEnd: selectionEnd + INDENT_UNIT.length,
    }
  }

  const block = touchedBlock(value, selectionStart, selectionEnd)
  const skipEmpty = block.lines.length > 1
  const deltas = block.lines.map((line) => (skipEmpty && line === '' ? 0 : INDENT_UNIT.length))
  const lines = block.lines.map((line, index) => (deltas[index] ? INDENT_UNIT + line : line))
  return rebuild(block, lines, deltas, selectionStart, selectionEnd, false)
}

export function outdentSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TextEdit | null {
  const block = touchedBlock(value, selectionStart, selectionEnd)
  const deltas = block.lines.map((line) => {
    return Math.min(INDENT_UNIT.length, /^ */.exec(line)![0].length)
  })
  if (deltas.every((delta) => delta === 0)) {
    return null
  }
  const lines = block.lines.map((line, index) => line.slice(deltas[index]))
  return rebuild(block, lines, deltas, selectionStart, selectionEnd, true)
}
