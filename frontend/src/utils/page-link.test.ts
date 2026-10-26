import { describe, expect, it } from 'vitest'
import { toLinkedPagePath } from './page-link'

const ORIGIN = 'https://wiki.example.com'

describe('toLinkedPagePath', () => {
  it('normalizes an internal page link the way the backend indexes it', () => {
    expect(toLinkedPagePath('/pages/Docs/Guide/?x=1#setup', ORIGIN)).toBe('/docs/guide')
    expect(toLinkedPagePath('/pages/caf%C3%A9', ORIGIN)).toBe('/café')
  })

  it('accepts an absolute link to this instance', () => {
    expect(toLinkedPagePath(`${ORIGIN}/pages/faq`, ORIGIN)).toBe('/faq')
  })

  it.each([
    'https://other.example.com/pages/faq',
    '//wiki.example.com/pages/faq',
    '#setup',
    '/api/media/123/raw',
    '/pages/',
    '/pages/tree',
    '/pages/%E0%A4%A',
  ])('ignores %s', (href) => {
    expect(toLinkedPagePath(href, ORIGIN)).toBeNull()
  })
})
