import { describe, expect, it } from 'vitest'
import {
  alignVisibleText,
  blockSourceSlice,
  caretPositionFromValue,
  findContainingAnchorIndex,
  visibleSourceText,
} from './markdown-caret-mapping'

function locate(source: string, marker: string, segments: string[], startLine = 1) {
  const index = source.indexOf(marker)
  const { line, column } = caretPositionFromValue(source, index)
  const slice = blockSourceSlice(source, startLine, line, column)
  return alignVisibleText(segments, visibleSourceText(slice))
}

describe('caretPositionFromValue', () => {
  it('returns 1-based line and 0-based column', () => {
    expect(caretPositionFromValue('a\nbc\nd', 0)).toEqual({ line: 1, column: 0 })
    expect(caretPositionFromValue('a\nbc\nd', 3)).toEqual({ line: 2, column: 1 })
    expect(caretPositionFromValue('a\nbc\nd', 6)).toEqual({ line: 3, column: 1 })
    expect(caretPositionFromValue('a\nb', 99)).toEqual({ line: 2, column: 1 })
  })
})

describe('findContainingAnchorIndex', () => {
  const entries = [
    { line: 1, endLine: 1 },
    { line: 3, endLine: 8 },
    { line: 3, endLine: 4 },
    { line: 6, endLine: 6 },
  ]

  it('returns the innermost block containing the line', () => {
    expect(findContainingAnchorIndex(entries, 3)).toBe(2)
    expect(findContainingAnchorIndex(entries, 6)).toBe(3)
  })

  it('falls back to the outer block on a gap line', () => {
    expect(findContainingAnchorIndex(entries, 5)).toBe(1)
  })

  it('returns -1 when nothing contains the line', () => {
    expect(findContainingAnchorIndex(entries, 2)).toBe(-1)
    expect(findContainingAnchorIndex(entries, 9)).toBe(-1)
    expect(findContainingAnchorIndex([], 1)).toBe(-1)
  })
})

describe('blockSourceSlice', () => {
  const value = 'zero\none\ntwo\nthree'

  it('joins lines from the block start up to the caret column', () => {
    expect(blockSourceSlice(value, 2, 3, 2)).toBe('one\ntw')
    expect(blockSourceSlice(value, 1, 1, 2)).toBe('ze')
    expect(blockSourceSlice(value, 4, 4, 99)).toBe('three')
  })
})

describe('visibleSourceText', () => {
  it('strips heading markers', () => {
    expect(visibleSourceText('## Titre')).toBe('Titre')
  })

  it('strips emphasis markers', () => {
    expect(visibleSourceText('Du **gras** et _ital_')).toBe('Du gras et ital')
    expect(visibleSourceText('snake_case_name')).toBe('snake_case_name')
  })

  it('strips inline code backticks', () => {
    expect(visibleSourceText('un `code` ici')).toBe('un code ici')
  })

  it('keeps link text, complete or cut at the caret', () => {
    expect(visibleSourceText('voir [la doc](/pages/x) puis')).toBe('voir la doc puis')
    expect(visibleSourceText('voir [la doc](/pa')).toBe('voir la doc')
    expect(visibleSourceText('voir [la d')).toBe('voir la d')
  })

  it('drops images', () => {
    expect(visibleSourceText('avant ![alt](http://x/y.png) après')).toBe('avant  après')
  })

  it('strips list markers and task boxes', () => {
    expect(visibleSourceText('- [ ] tâche')).toBe('tâche')
    expect(visibleSourceText('12. élément')).toBe('élément')
    expect(visibleSourceText('  * sous-élément')).toBe('sous-élément')
  })

  it('strips blockquote markers on continuation lines', () => {
    expect(visibleSourceText('> premier\n> second')).toBe('premier\nsecond')
  })

  it('keeps code verbatim and drops fences', () => {
    expect(visibleSourceText('```ts\nconst a = *b*\n```')).toBe('const a = *b*')
  })
})

describe('alignVisibleText', () => {
  it('places the caret after a heading prefix', () => {
    expect(locate('## Titre ici', 'ici', ['Titre ici'])).toEqual({ segment: 0, offset: 6 })
  })

  it('places the caret inside and after bold text', () => {
    const segments = ['Du ', 'gras', ' et ', 'ital']
    const source = 'Du **gras** et _ital_'
    expect(locate(source, 'ras', segments)).toEqual({ segment: 1, offset: 1 })
    expect(locate(source, ' et', segments)).toEqual({ segment: 1, offset: 4 })
    expect(locate(source, 'ital', segments)).toEqual({ segment: 2, offset: 4 })
  })

  it('places the caret in inline code and link text', () => {
    expect(locate('un `code` ici', 'de`', ['un ', 'code', ' ici'])).toEqual({ segment: 1, offset: 2 })
    expect(locate('voir [la doc](/x) fin', 'doc', ['voir ', 'la doc', ' fin'])).toEqual({ segment: 1, offset: 3 })
  })

  it('places the caret in a list item', () => {
    expect(locate('- [ ] tâche finie', 'finie', ['tâche finie'])).toEqual({ segment: 0, offset: 6 })
  })

  it('handles a wrapped paragraph in one text node', () => {
    const source = 'première ligne\nseconde ligne'
    const second = source.lastIndexOf('ligne')
    const { line, column } = caretPositionFromValue(source, second + 2)
    const slice = blockSourceSlice(source, 1, line, column)
    expect(alignVisibleText(['première ligne seconde ligne'], visibleSourceText(slice))).toEqual({
      segment: 0,
      offset: 25,
    })
  })

  it('advances past one whitespace when the caret follows a space', () => {
    const source = 'Du **gras** et'
    const slice = blockSourceSlice(source, 1, 1, 'Du **gras** '.length)
    expect(alignVisibleText(['Du ', 'gras', ' et'], visibleSourceText(slice))).toEqual({ segment: 2, offset: 1 })
  })

  it('places the caret at the first character for an empty slice', () => {
    expect(alignVisibleText(['  ', 'abc'], '')).toEqual({ segment: 1, offset: 0 })
  })

  it('returns null when the rendered text does not match the source', () => {
    expect(alignVisibleText(['Node1', 'Node2', 'Start'], visibleSourceText('flowchart LR\n  A[Brouillon] --> B'))).toBeNull()
  })

  it('returns null without rendered text', () => {
    expect(alignVisibleText([' ', ''], 'abc')).toBeNull()
  })
})
