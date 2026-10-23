import { useTranslation } from 'react-i18next'
import { Badge } from '#components/ui/badge'
import type { Webhook, WebhookDeliveryStatus } from '#api/webhooks'

const DELIVERY_STATUS_VARIANTS = {
  pending: 'secondary',
  success: 'outline',
  failed: 'destructive',
} as const

export function DeliveryStatusBadge({ status }: { status: WebhookDeliveryStatus }) {
  const { t } = useTranslation()
  return <Badge variant={DELIVERY_STATUS_VARIANTS[status]}>{t(`admin.webhooks.deliveryStatus.${status}`)}</Badge>
}

export function WebhookStateBadge({ webhook }: { webhook: Pick<Webhook, 'enabled' | 'disabledReason'> }) {
  const { t } = useTranslation()
  if (webhook.enabled) {
    return <Badge variant="outline">{t('admin.webhooks.stateEnabled')}</Badge>
  }
  if (webhook.disabledReason) {
    return <Badge variant="destructive">{t('admin.webhooks.stateAutoDisabled')}</Badge>
  }
  return <Badge variant="secondary">{t('admin.webhooks.stateDisabled')}</Badge>
}

export function WebhookState({
  webhook,
}: {
  webhook: Pick<Webhook, 'enabled' | 'disabledReason' | 'consecutiveFailures'>
}) {
  const { t } = useTranslation()
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <WebhookStateBadge webhook={webhook} />
      {!webhook.enabled && webhook.disabledReason && (
        <span className="text-xs whitespace-normal text-muted-foreground" title={webhook.disabledReason}>
          {t('admin.webhooks.autoDisabledReason', { count: webhook.consecutiveFailures })}
        </span>
      )}
    </div>
  )
}
