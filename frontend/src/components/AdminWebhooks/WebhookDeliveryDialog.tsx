import { useState } from 'react'
import { RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '#components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#components/ui/dialog'
import { DeliveryStatusBadge } from '#components/AdminWebhooks/WebhookBadges'
import { redeliverWebhookDelivery, type WebhookDelivery } from '#api/webhooks'
import { extractErrorMessage } from '#lib/api-errors'
import { formatDateTime } from '#utils/relative-time'

interface WebhookDeliveryDialogProps {
  delivery: WebhookDelivery | null
  webhookEnabled: boolean
  onClose: () => void
  onRedelivered: (delivery: WebhookDelivery) => void
}

function prettyPayload(payload: string): string {
  try {
    return JSON.stringify(JSON.parse(payload), null, 2)
  } catch {
    return payload
  }
}

export function WebhookDeliveryDialog({ delivery, webhookEnabled, onClose, onRedelivered }: WebhookDeliveryDialogProps) {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)

  async function handleRedeliver() {
    if (!delivery) return
    setPending(true)
    try {
      const created = await redeliverWebhookDelivery(delivery.id)
      onRedelivered(created)
      toast.success(t('admin.webhooks.log.redelivered'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('admin.webhooks.log.redeliverFailed')))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={delivery !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {delivery && (
          <>
            <DialogHeader>
              <DialogTitle className="font-mono break-all">{delivery.event}</DialogTitle>
              <DialogDescription>{formatDateTime(delivery.createdAt)}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <DeliveryStatusBadge status={delivery.status} />
              {delivery.lastStatusCode !== null && <span>HTTP {delivery.lastStatusCode}</span>}
              <span className="text-muted-foreground">
                {t('admin.webhooks.log.attemptsCount', { count: delivery.attempts })}
              </span>
            </div>
            {delivery.lastError && (
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm font-medium">{t('admin.webhooks.lastError')}</p>
                <p className="font-mono text-xs break-all text-destructive">{delivery.lastError}</p>
              </div>
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm font-medium">{t('admin.webhooks.log.payload')}</p>
              <pre className="max-h-80 overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-xs break-all whitespace-pre-wrap">
                {prettyPayload(delivery.payload)}
              </pre>
            </div>
            {!webhookEnabled && (
              <p className="text-sm text-muted-foreground">{t('admin.webhooks.log.redeliverDisabled')}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t('common.close')}
              </Button>
              {webhookEnabled && (
                <Button type="button" disabled={pending} onClick={handleRedeliver}>
                  <RotateCw />
                  {t('admin.webhooks.log.redeliver')}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
