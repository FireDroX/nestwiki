import { z } from 'zod'
import type { TFunction } from 'i18next'
import { WEBHOOK_EVENTS, WEBHOOK_FORMATS } from '#api/webhooks'
import { isHttpUrl } from '#utils/webhook-url'

const WEBHOOK_NAME_MAX_LENGTH = 100
const WEBHOOK_URL_MAX_LENGTH = 2048

export function createWebhookSchema(t: TFunction) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t('admin.webhooks.form.nameRequired'))
      .max(WEBHOOK_NAME_MAX_LENGTH, t('admin.webhooks.form.nameTooLong', { count: WEBHOOK_NAME_MAX_LENGTH })),
    url: z
      .string()
      .trim()
      .max(WEBHOOK_URL_MAX_LENGTH, t('admin.webhooks.form.urlTooLong', { count: WEBHOOK_URL_MAX_LENGTH }))
      .refine(isHttpUrl, t('admin.webhooks.form.urlInvalid')),
    format: z.enum(WEBHOOK_FORMATS),
    events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, t('admin.webhooks.form.eventsRequired')),
    includePrivatePages: z.boolean(),
    scopePageId: z.string().nullable(),
    enabled: z.boolean(),
  })
}

export type WebhookFormValues = z.infer<ReturnType<typeof createWebhookSchema>>
