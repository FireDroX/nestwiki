import { useState } from 'react'
import { Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '#components/ui/button'
import { DeliveryStatusBadge } from '#components/AdminWebhooks/WebhookBadges'
import { testWebhook, type WebhookDelivery } from '#api/webhooks'
import { extractErrorMessage } from '#lib/api-errors'

interface WebhookTestPanelProps {
  webhookId: string
  onSent: () => void
}

export function WebhookTestPanel({ webhookId, onSent }: WebhookTestPanelProps) {
  const { t } = useTranslation()
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<WebhookDelivery | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    setSending(true)
    setError(null)
    try {
      setResult(await testWebhook(webhookId))
      onSent()
    } catch (caught) {
      setResult(null)
      setError(extractErrorMessage(caught, t('admin.webhooks.test.failed')))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Button type="button" variant="outline" size="sm" className="w-fit" disabled={sending} onClick={handleSend}>
        <Send />
        {t(sending ? 'admin.webhooks.test.sending' : 'admin.webhooks.test.send')}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && (
        <dl
          aria-label={t('admin.webhooks.test.resultLabel')}
          className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm"
        >
          <dt className="text-muted-foreground">{t('admin.webhooks.columnStatus')}</dt>
          <dd>
            <DeliveryStatusBadge status={result.status} />
          </dd>
          <dt className="text-muted-foreground">{t('admin.webhooks.columnStatusCode')}</dt>
          <dd>{result.lastStatusCode ?? '—'}</dd>
          <dt className="text-muted-foreground">{t('admin.webhooks.columnDuration')}</dt>
          <dd>{result.durationMs !== null ? t('admin.webhooks.durationMs', { count: result.durationMs }) : '—'}</dd>
          {result.lastError && (
            <>
              <dt className="text-muted-foreground">{t('admin.webhooks.lastError')}</dt>
              <dd className="font-mono text-xs break-all text-destructive">{result.lastError}</dd>
            </>
          )}
        </dl>
      )}
    </div>
  )
}
