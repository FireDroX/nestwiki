import { describe, expect, it } from 'vitest'
import { isReservedSlug } from './slug'

describe('isReservedSlug', () => {
  it('reserves "tree" only for root pages', () => {
    expect(isReservedSlug('tree', 1)).toBe(true)
    expect(isReservedSlug('tree', 2)).toBe(false)
  })

  it.each(['versions', 'comments', 'tags', 'access-rules', 'stats'])(
    'reserves "%s" only for direct children of a root page',
    (slug) => {
      expect(isReservedSlug(slug, 1)).toBe(false)
      expect(isReservedSlug(slug, 2)).toBe(true)
      expect(isReservedSlug(slug, 3)).toBe(false)
    },
  )

  it('never reserves a regular slug', () => {
    expect(isReservedSlug('installation', 2)).toBe(false)
  })
})
