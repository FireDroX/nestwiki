import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'
import { createPageMetadataSchema } from './page-metadata.schema'

const t = ((key: string) => key) as unknown as TFunction

const values = { title: 'Stats', slug: 'stats', visibility: 'public' as const, parentId: null }

describe('createPageMetadataSchema', () => {
  it('rejects a reserved slug when creating a page', () => {
    const result = createPageMetadataSchema(t, 'create').safeParse(values)

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('pageMetadataForm.slugReserved')
  })

  it('accepts a regular slug when creating a page', () => {
    const result = createPageMetadataSchema(t, 'create').safeParse({ ...values, slug: 'statistiques' })

    expect(result.success).toBe(true)
  })

  it('does not block editing an existing page whose immutable slug is reserved', () => {
    const result = createPageMetadataSchema(t, 'edit').safeParse(values)

    expect(result.success).toBe(true)
  })
})
