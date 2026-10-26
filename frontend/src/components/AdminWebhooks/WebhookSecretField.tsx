import { useState } from 'react'
import { Copy, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '#components/ui/button'
import { ConfirmActionButton } from '#components/AdminUsers/ConfirmActionButton'
import { rotateWebhookSecret, type Webhook } from '#api/webhooks'
import { extractErrorMessage } from '#lib/api-errors'

const MASK = '••••••••••••••••••••••••'

interface WebhookSecretFieldProps {
  webhook: Webhook
  onRotated: (webhook: Webhook) => void
}

export function WebhookSecretField({ webhook, onRotated }: WebhookSecretFieldProps) {
  const { t } = useTranslation()
  const [revealed, setRevealed] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(webhook.secret)
      toast.success(t('admin.webhooks.secret.copied'))
    } catch {
      toast.error(t('admin.webhooks.secret.copyFailed'))
    }
  }

  async function handleRotate() {
    try {
      const updated = await rotateWebhookSecret(webhook.id)
      onRotated(updated)
      setRevealed(true)
      toast.success(t('admin.webhooks.secret.rotated'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('admin.webhooks.secret.rotateFailed')))
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <code
        data-testid="webhook-secret"
        className="rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm break-all"
      >
        {revealed ? webhook.secret : MASK}
      </code>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setRevealed((current) => !current)}>
          {revealed ? <EyeOff /> : <Eye />}
          {t(revealed ? 'admin.webhooks.secret.hide' : 'admin.webhooks.secret.show')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          <Copy />
          {t('admin.webhooks.secret.copy')}
        </Button>
        <ConfirmActionButton
          label={
            <>
              <RefreshCw />
              {t('admin.webhooks.secret.rotate')}
            </>
          }
          confirmTitle={t('admin.webhooks.secret.rotateConfirmTitle')}
          confirmDescription={t('admin.webhooks.secret.rotateConfirmDescription')}
          confirmLabel={t('admin.webhooks.secret.rotate')}
          variant="destructive"
          onConfirm={handleRotate}
        />
      </div>
    </div>
  )
}
