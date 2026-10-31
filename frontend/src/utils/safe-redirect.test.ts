import { describe, expect, it } from 'vitest'
import { sameOriginPath } from './safe-redirect'

const ORIGIN = 'https://wiki.example.com'

describe('sameOriginPath', () => {
  it.each([
    ['/oauth/consent?client_id=a&state=b', '/oauth/consent?client_id=a&state=b'],
    [`${ORIGIN}/oauth/consent?client_id=a#top`, '/oauth/consent?client_id=a#top'],
    ['pages/docs', '/pages/docs'],
  ])('keeps the same-origin destination %s', (raw, expected) => {
    expect(sameOriginPath(raw, ORIGIN)).toBe(expected)
  })

  it.each([
    'javascript:alert(document.domain)',
    ' JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'https://evil.example/',
    '//evil.example/path',
    '/\\evil.example/path',
    'http://wiki.example.com/',
    'https://wiki.example.com.evil.example/',
  ])('refuses %s', (raw) => {
    expect(sameOriginPath(raw, ORIGIN)).toBeNull()
  })

  it('ignores a missing destination', () => {
    expect(sameOriginPath(null, ORIGIN)).toBeNull()
    expect(sameOriginPath('', ORIGIN)).toBeNull()
  })
})
