import { visit } from 'unist-util-visit'
import type { Element, ElementContent, Root, Text } from 'hast'

export const CALLOUT_TYPES = ['note', 'tip', 'important', 'warning', 'caution'] as const

export type CalloutType = (typeof CALLOUT_TYPES)[number]

export const CALLOUT_TAG_NAME = 'wiki-callout'

const CALLOUT_MARKER = /^\s*\[!(note|tip|important|warning|caution)\][ \t]*([^\n]*)(?:\n|$)/i

interface CalloutMarker {
  type: CalloutType
  title: string
}

function isWhitespaceText(node: ElementContent): boolean {
  return node.type === 'text' && node.value.trim() === ''
}

function findFirstParagraph(blockquote: Element): Element | undefined {
  const firstContent = blockquote.children.find((child) => !isWhitespaceText(child))
  return firstContent?.type === 'element' && firstContent.tagName === 'p' ? firstContent : undefined
}

function consumeMarker(paragraph: Element): CalloutMarker | null {
  const firstChild = paragraph.children[0]
  if (firstChild?.type !== 'text') {
    return null
  }
  const match = CALLOUT_MARKER.exec(firstChild.value)
  if (!match) {
    return null
  }

  const remainingText: Text = { type: 'text', value: firstChild.value.slice(match[0].length) }
  paragraph.children = remainingText.value === ''
    ? paragraph.children.slice(1)
    : [remainingText, ...paragraph.children.slice(1)]

  return { type: match[1].toLowerCase() as CalloutType, title: match[2].trim() }
}

function hasVisibleContent(paragraph: Element): boolean {
  return paragraph.children.some((child) => !isWhitespaceText(child))
}

export function rehypeCallouts() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'blockquote') {
        return
      }
      const paragraph = findFirstParagraph(node)
      const marker = paragraph ? consumeMarker(paragraph) : null
      if (!paragraph || !marker) {
        return
      }

      node.tagName = CALLOUT_TAG_NAME
      node.properties = {
        dataCalloutType: marker.type,
        ...(marker.title ? { dataCalloutTitle: marker.title } : {}),
      }
      if (!hasVisibleContent(paragraph)) {
        node.children = node.children.filter((child) => child !== paragraph)
      }
    })
  }
}
