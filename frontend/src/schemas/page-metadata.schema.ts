import { z } from 'zod'
import type { TFunction } from 'i18next'

const SLUG_REGEX = /^[a-z0-9-]+$/
const SLUG_MAX_LENGTH = 255
const TITLE_MAX_LENGTH = 255
export const RESERVED_PAGE_SLUGS: readonly string[] = ['tree', 'versions', 'comments', 'tags', 'access-rules', 'stats']

export function createPageMetadataSchema(t: TFunction, mode: 'create' | 'edit') {
  const slug = z
    .string()
    .min(1, t('pageMetadataForm.slugRequired'))
    .max(SLUG_MAX_LENGTH, t('pageMetadataForm.slugTooLong', { count: SLUG_MAX_LENGTH }))
    .regex(SLUG_REGEX, t('pageMetadataForm.slugInvalid'))

  return z.object({
    title: z
      .string()
      .min(1, t('pageMetadataForm.titleRequired'))
      .max(TITLE_MAX_LENGTH, t('pageMetadataForm.titleTooLong', { count: TITLE_MAX_LENGTH })),
    slug:
      mode === 'create'
        ? slug.refine((value) => !RESERVED_PAGE_SLUGS.includes(value), t('pageMetadataForm.slugReserved'))
        : slug,
    visibility: z.enum(['public', 'private']),
    parentId: z.string().nullable(),
  })
}

export type PageMetadataFormValues = z.infer<ReturnType<typeof createPageMetadataSchema>>
