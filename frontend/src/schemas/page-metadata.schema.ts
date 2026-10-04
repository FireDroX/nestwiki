import { z } from 'zod'
import type { TFunction } from 'i18next'
import { isReservedSlug } from '#utils/slug'

const SLUG_REGEX = /^[a-z0-9-]+$/
const SLUG_MAX_LENGTH = 255
const TITLE_MAX_LENGTH = 255

export function createPageMetadataSchema(t: TFunction, depthOfNewPage?: (parentId: string | null) => number | null) {
  return z
    .object({
      title: z
        .string()
        .min(1, t('pageMetadataForm.titleRequired'))
        .max(TITLE_MAX_LENGTH, t('pageMetadataForm.titleTooLong', { count: TITLE_MAX_LENGTH })),
      slug: z
        .string()
        .min(1, t('pageMetadataForm.slugRequired'))
        .max(SLUG_MAX_LENGTH, t('pageMetadataForm.slugTooLong', { count: SLUG_MAX_LENGTH }))
        .regex(SLUG_REGEX, t('pageMetadataForm.slugInvalid')),
      visibility: z.enum(['public', 'private']),
      parentId: z.string().nullable(),
    })
    .superRefine((values, context) => {
      const depth = depthOfNewPage?.(values.parentId)
      if (depth && isReservedSlug(values.slug, depth)) {
        context.addIssue({ code: 'custom', path: ['slug'], message: t('pageMetadataForm.slugReserved') })
      }
    })
}

export type PageMetadataFormValues = z.infer<ReturnType<typeof createPageMetadataSchema>>
