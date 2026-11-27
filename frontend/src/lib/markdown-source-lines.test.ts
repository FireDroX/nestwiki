import { describe, expect, it } from 'vitest'
import type { Element, Root } from 'hast'
import { pickSourceLineProps, rehypeSourceLines } from './markdown-source-lines'

function element(tagName: string, startLine: number, endLine: number, children: Element[] = []): Element {
  return {
    type: 'element',
    tagName,
    properties: {},
    children,
    position: {
      start: { line: startLine, column: 1, offset: 0 },
      end: { line: endLine, column: 1, offset: 0 },
    },
  }
}

describe('rehypeSourceLines', () => {
  it('sets start and end lines on block elements', () => {
    const paragraph = element('p', 3, 4)
    const tree: Root = { type: 'root', children: [paragraph] }
    rehypeSourceLines()(tree)
    expect(paragraph.properties).toEqual({ dataSourceLine: 3, dataSourceLineEnd: 4 })
  })

  it('skips inline elements nested in a block and elements without position', () => {
    const strong = element('strong', 3, 3)
    const paragraph = element('p', 3, 3, [strong])
    const unpositioned: Element = { type: 'element', tagName: 'p', properties: {}, children: [] }
    const tree: Root = { type: 'root', children: [paragraph, unpositioned] }
    rehypeSourceLines()(tree)
    expect(strong.properties).toEqual({})
    expect(unpositioned.properties).toEqual({})
  })
})

describe('pickSourceLineProps', () => {
  it('keeps only the source line attributes', () => {
    expect(pickSourceLineProps({ 'data-source-line': 2, id: 'x' })).toEqual({ 'data-source-line': 2 })
    expect(pickSourceLineProps({ id: 'x' })).toBeUndefined()
  })
})
