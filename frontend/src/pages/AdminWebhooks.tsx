import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AdminNav } from '#components/AdminNav'
import { Button } from '#components/ui/button'
import { WebhookFormDialog } from '#components/AdminWebhooks/WebhookFormDialog'
import { WebhooksTable } from '#components/AdminWebhooks/WebhooksTable'
import { listWebhooks, type WebhookSummary } from '#api/webhooks'
import { PAGE_PADDING } from '#utils/page-layout'

type Status = 'loading' | 'ready' | 'error'

export function AdminWebhooks() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [webhooks, setWebhooks] = useState<WebhookSummary[]>([])
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setStatus('loading')
      try {
        const result = await listWebhooks()
        if (cancelled) return
        setWebhooks(result)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className={PAGE_PADDING}>
      <AdminNav />
      <div className="mt-5 mb-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{t('admin.webhooks.intro')}</p>
        <WebhookFormDialog
          trigger={
            <Button type="button" size="sm" className="shrink-0">
              <Plus /> {t('admin.webhooks.createButton')}
            </Button>
          }
          onSaved={(webhook) => navigate(`/admin/webhooks/${webhook.id}`)}
        />
      </div>
      {status === 'loading' && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
      {status === 'error' && <p className="text-sm text-destructive">{t('admin.webhooks.loadError')}</p>}
      {status === 'ready' && <WebhooksTable webhooks={webhooks} />}
    </div>
  )
}
