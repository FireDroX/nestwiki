import {
  isTokenBadString,
  isTokenBadURL,
  isTokenCloseCurly,
  isTokenCloseParen,
  isTokenCloseSquare,
  isTokenFunction,
  isTokenOpenCurly,
  isTokenOpenParen,
  isTokenOpenSquare,
  tokenize,
} from '@csstools/css-tokenizer'
import { visit } from 'unist-util-visit'
import type { Element, Root } from 'hast'

function scrubDangerousCss(css: string): string {
  return css
    .replace(/@import\s+[^;]*;?/gi, '')
    .replace(/url\(\s*['"]?\s*javascript:[^)]*\)/gi, 'url()')
}

function hasBalancedBlocks(css: string): boolean {
  let hasParseError = false
  const tokens = tokenize(
    { css },
    {
      onParseError: () => {
        hasParseError = true
      },
    },
  )
  const expectedClosers: string[] = []
  for (const token of tokens) {
    if (isTokenBadString(token) || isTokenBadURL(token)) {
      return false
    }
    if (isTokenOpenCurly(token)) {
      expectedClosers.push('}')
    } else if (isTokenOpenParen(token) || isTokenFunction(token)) {
      expectedClosers.push(')')
    } else if (isTokenOpenSquare(token)) {
      expectedClosers.push(']')
    } else if (isTokenCloseCurly(token) || isTokenCloseParen(token) || isTokenCloseSquare(token)) {
      if (expectedClosers.pop() !== token[1]) {
        return false
      }
    }
  }
  return expectedClosers.length === 0 && !hasParseError
}

export function rehypeScopeStyles(scopeId: string) {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'style') {
        return
      }
      for (const child of node.children) {
        if (child.type === 'text') {
          const scrubbed = scrubDangerousCss(child.value)
          child.value = hasBalancedBlocks(scrubbed)
            ? `@scope ([id="${scopeId}"]) {\n${scrubbed}\n}`
            : `@scope ([id="${scopeId}"]) {\n}\n`
        }
      }
    })
  }
}
