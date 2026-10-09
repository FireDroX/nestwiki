import { describe, expect, it } from 'vitest'
import { buildTocTree, collectTocHeadings, shouldShowTableOfContents } from './table-of-contents'

function buildRoot(html: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = html
  return root
}

describe('collectTocHeadings', () => {
  it('collects h1 to h3 headings with an id, in document order', () => {
    const root = buildRoot(
      '<h1 id="a">A</h1><h2 id="b">B</h2><h3 id="c">C</h3><h4 id="d">D</h4><h2 id="e">E</h2>',
    )
    expect(collectTocHeadings(root)).toEqual([
      { id: 'a', text: 'A', level: 1 },
      { id: 'b', text: 'B', level: 2 },
      { id: 'c', text: 'C', level: 3 },
      { id: 'e', text: 'E', level: 2 },
    ])
  })

  it('ignores headings without an id or without text', () => {
    const root = buildRoot('<h2>Sans id</h2><h2 id="vide"> </h2><h2 id="ok">Ok</h2>')
    expect(collectTocHeadings(root)).toEqual([{ id: 'ok', text: 'Ok', level: 2 }])
  })
})

describe('shouldShowTableOfContents', () => {
  it('needs at least two headings', () => {
    const heading = { id: 'a', text: 'A', level: 2 }
    expect(shouldShowTableOfContents([])).toBe(false)
    expect(shouldShowTableOfContents([heading])).toBe(false)
    expect(shouldShowTableOfContents([heading, { ...heading, id: 'b' }])).toBe(true)
  })
})

describe('buildTocTree', () => {
  it('nests each heading under the closest previous heading of a higher level', () => {
    const h = (id: string, level: number) => ({ id, text: id, level })
    const tree = buildTocTree([h('a', 2), h('b', 3), h('c', 3), h('d', 2), h('e', 1), h('f', 3)])
    const shape = (nodes: ReturnType<typeof buildTocTree>): unknown =>
      nodes.map((node) => [node.heading.id, shape(node.children)])
    expect(shape(tree)).toEqual([
      ['a', [['b', []], ['c', []]]],
      ['d', []],
      ['e', [['f', []]]],
    ])
  })
})
