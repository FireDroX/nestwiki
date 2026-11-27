import { visit } from 'unist-util-visit'
import type { Element, Root } from 'hast'
import { CALLOUT_TAG_NAME } from '#lib/markdown-callouts'
import { MERMAID_TAG_NAME } from '#lib/markdown-mermaid'

export const SOURCE_LINE_ATTRIBUTE = 'data-source-line'
export const SOURCE_LINE_END_ATTRIBUTE = 'data-source-line-end'

const BLOCK_TAG_NAMES: ReadonlySet<string> = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'table',
  'thead',
  'tbody',
  'tr',
  'hr',
  'div',
  'details',
  'summary',
  'img',
  CALLOUT_TAG_NAME,
  MERMAID_TAG_NAME,
])

export function pickSourceLineProps(props: object): Record<string, unknown> | undefined {
  const entries = Object.entries(props).filter(
    ([name]) => name === SOURCE_LINE_ATTRIBUTE || name === SOURCE_LINE_END_ATTRIBUTE,
  )
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

export function rehypeSourceLines() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, _index, parent) => {
      const { position } = node
      if (!position) {
        return
      }
      if (!BLOCK_TAG_NAMES.has(node.tagName) && parent?.type !== 'root') {
        return
      }
      node.properties = {
        ...node.properties,
        dataSourceLine: position.start.line,
        dataSourceLineEnd: position.end.line,
      }
    })
  }
}
