import { visit, SKIP } from 'unist-util-visit'
import type { Element, ElementContent, Root } from 'hast'

export const MERMAID_TAG_NAME = 'wiki-mermaid'

function toPlainText(node: ElementContent): string {
  if (node.type === 'text') {
    return node.value
  }
  if (node.type === 'element') {
    return node.children.map(toPlainText).join('')
  }
  return ''
}

function findMermaidCode(pre: Element): Element | undefined {
  const [code] = pre.children
  if (pre.children.length !== 1 || code?.type !== 'element' || code.tagName !== 'code') {
    return undefined
  }
  const classNames = code.properties?.className
  return Array.isArray(classNames) && classNames.includes('language-mermaid') ? code : undefined
}

export function rehypeMermaid() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'pre') {
        return
      }
      const code = findMermaidCode(node)
      if (!code) {
        return
      }
      node.tagName = MERMAID_TAG_NAME
      node.properties = {}
      node.children = [{ type: 'text', value: code.children.map(toPlainText).join('').replace(/\n$/, '') }]
      return SKIP
    })
  }
}
