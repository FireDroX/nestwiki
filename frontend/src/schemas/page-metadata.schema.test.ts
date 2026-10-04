import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'
import { createPageMetadataSchema } from './page-metadata.schema'

const t = ((key: string) => key) as unknown as TFunction

const values = { title: 'Stats', slug: 'stats', visibility: 'public' as const, parentId: 'root-page' }

describe('createPageMetadataSchema', () => {
  it('rejects a slug reserved at the depth where the page would be created', () => {
    const result = createPageMetadataSchema(t, () => 2).safeParse(values)

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]).toMatchObject({ path: ['slug'], message: 'pageMetadataForm.slugReserved' })
  })

  it('accepts the same slug deeper in the tree, where it does not collide with any route', () => {
    expect(createPageMetadataSchema(t, () => 3).safeParse(values).success).toBe(true)
  })

  it('does not check reserved slugs without a depth resolver (editing an existing page)', () => {
    expect(createPageMetadataSchema(t).safeParse(values).success).toBe(true)
  })
})
