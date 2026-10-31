import { describe, expect, it } from 'vitest'
import type { Element, Root, Text } from 'hast'
import { rehypeScopeStyles } from './markdown-css-scope'

const EMPTY_SCOPE = '@scope ([id="s1"]) {\n}\n'

function scope(css: string): string {
  const text: Text = { type: 'text', value: css }
  const style: Element = { type: 'element', tagName: 'style', properties: {}, children: [text] }
  const tree: Root = { type: 'root', children: [style] }
  rehypeScopeStyles('s1')(tree)
  return text.value
}

describe('rehypeScopeStyles', () => {
  it.each([
    'p { color: red }',
    'p { & span { color: blue } }',
    '@media (min-width: 40rem) { p { color: green } }',
    'a[href^="/pages"]::after { content: "}" }',
    'p { content: "\\"}" }',
    'p::before { content: "\\7b" } .a\\:b { color: var(--primary) }',
    '/* } */ p { background: url(image.png) }',
    '@keyframes spin { from { rotate: 0deg } to { rotate: 360deg } }',
  ])('wraps well-formed CSS in the scope: %s', (css) => {
    expect(scope(css)).toBe(`@scope ([id="s1"]) {\n${css}\n}`)
  })

  it.each([
    ['an escaped opening brace', 'x\\{}body{outline:5px solid red}'],
    ['an unquoted url() hiding a brace', 'a{background:url({)}}body{color:red}'],
    ['a brace inside parentheses', 'a:is({) } body{color:red}'],
    ['a brace removed with an @import', '@import {;}body{color:red}'],
    ['a stray closing brace', '} body { background: red } p {'],
    ['an unterminated string', 'p { content: "\nbroken } body { background: red } p {" }'],
    ['an unterminated comment', 'p { color: red } /* }'],
    ['mismatched brackets', 'p { color: rgb(0 0 0 } )'],
  ])('falls back to an empty scope on %s', (_label, css) => {
    expect(scope(css)).toBe(EMPTY_SCOPE)
  })

  it('removes @import rules and javascript: urls', () => {
    expect(scope('@import url(x.css);\np { background: url("javascript:void") }')).toBe(
      '@scope ([id="s1"]) {\n\np { background: url() }\n}',
    )
    expect(scope('p { background: url(javascript:alert(1)) }')).not.toContain('javascript:')
  })
})
