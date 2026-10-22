import { apiClient } from '#lib/api-client'
import type { ResponseDto } from '#api/response-dto'

export const WEBHOOK_FORMATS = ['json', 'discord', 'slack'] as const
export type WebhookFormat = (typeof WEBHOOK_FORMATS)[number]

export const WEBHOOK_EVENT_GROUPS = [
  {
    id: 'pages',
    events: ['page.created', 'page.updated', 'page.moved', 'page.deleted', 'page.restored', 'page.published'],
  },
  { id: 'comments', events: ['comment.created'] },
  { id: 'import', events: ['pages.imported'] },
] as const

export type WebhookEventName = (typeof WEBHOOK_EVENT_GROUPS)[number]['events'][number]
export type WebhookDeliveredEvent = WebhookEventName | 'webhook.test'

export const WEBHOOK_EVENTS: WebhookEventName[] = WEBHOOK_EVENT_GROUPS.flatMap((group) => [...group.events])

export const WEBHOOK_DELIVERY_STATUSES = ['pending', 'success', 'failed'] as const
export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number]

export interface Webhook {
  id: string
  name: string
  url: string
  format: WebhookFormat
  events: WebhookEventName[]
  secret: string
  enabled: boolean
  includePrivatePages: boolean
  scopePageId: string | null
  consecutiveFailures: number
  disabledReason: string | null
  createdById: string
  createdAt: string
  updatedAt: string
}

export interface WebhookLastDelivery {
  createdAt: string
  status: WebhookDeliveryStatus
  lastStatusCode: number | null
}

export interface WebhookSummary extends Webhook {
  lastDelivery: WebhookLastDelivery | null
}

export interface WebhookInput {
  name: string
  url: string
  format: WebhookFormat
  events: WebhookEventName[]
  includePrivatePages: boolean
  scopePageId: string | null
  enabled: boolean
}

export interface WebhookDelivery {
  id: string
  webhookId: string
  event: WebhookDeliveredEvent
  payload: string
  status: WebhookDeliveryStatus
  attempts: number
  nextAttemptAt: string | null
  lastStatusCode: number | null
  lastError: string | null
  durationMs: number | null
  createdAt: string
  deliveredAt: string | null
}

export interface WebhookDeliveryPage {
  items: WebhookDelivery[]
  total: number
}

export interface ListWebhookDeliveriesParams {
  status?: WebhookDeliveryStatus
  page?: number
  limit?: number
}

export async function listWebhooks(): Promise<WebhookSummary[]> {
  const { data } = await apiClient.get<ResponseDto<WebhookSummary[]>>('/admin/webhooks')
  return data.data
}

export async function getWebhook(id: string): Promise<Webhook> {
  const { data } = await apiClient.get<ResponseDto<Webhook>>(`/admin/webhooks/${id}`)
  return data.data
}

export async function createWebhook(input: WebhookInput): Promise<Webhook> {
  const { data } = await apiClient.post<ResponseDto<Webhook>>('/admin/webhooks', input)
  return data.data
}

export async function updateWebhook(id: string, input: Partial<WebhookInput>): Promise<Webhook> {
  const { data } = await apiClient.patch<ResponseDto<Webhook>>(`/admin/webhooks/${id}`, input)
  return data.data
}

export async function deleteWebhook(id: string): Promise<void> {
  await apiClient.delete(`/admin/webhooks/${id}`)
}

export async function testWebhook(id: string): Promise<WebhookDelivery> {
  const { data } = await apiClient.post<ResponseDto<WebhookDelivery>>(`/admin/webhooks/${id}/test`)
  return data.data
}

export async function rotateWebhookSecret(id: string): Promise<Webhook> {
  const { data } = await apiClient.post<ResponseDto<Webhook>>(`/admin/webhooks/${id}/rotate-secret`)
  return data.data
}

export async function listWebhookDeliveries(
  id: string,
  params: ListWebhookDeliveriesParams,
): Promise<WebhookDeliveryPage> {
  const { data } = await apiClient.get<ResponseDto<WebhookDeliveryPage>>(`/admin/webhooks/${id}/deliveries`, {
    params,
  })
  return data.data
}

export async function redeliverWebhookDelivery(deliveryId: string): Promise<WebhookDelivery> {
  const { data } = await apiClient.post<ResponseDto<WebhookDelivery>>(
    `/admin/webhooks/deliveries/${deliveryId}/redeliver`,
  )
  return data.data
}
