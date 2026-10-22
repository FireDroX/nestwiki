import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ChevronLeft, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { AdminNav } from '#components/AdminNav'
import { Button } from '#components/ui/button'
import { ConfirmActionButton } from '#components/AdminUsers/ConfirmActionButton'
import { WebhookState } from '#components/AdminWebhooks/WebhookBadges'
import { WebhookDeliveriesLog } from '#components/AdminWebhooks/WebhookDeliveriesLog'
import { WebhookFormDialog } from '#components/AdminWebhooks/WebhookFormDialog'
import { WebhookSecretField } from '#components/AdminWebhooks/WebhookSecretField'
import { WebhookTestPanel } from '#components/AdminWebhooks/WebhookTestPanel'
import { deleteWebhook, getWebhook, type Webhook } from '#api/webhooks'
import { usePageTree } from '#hooks/usePageTree'
import { extractErrorMessage } from '#lib/api-errors'
import { PAGE_PADDING } from '#utils/page-layout'
import { flattenTree } from '#utils/page-tree'

type Status = 'loading' | 'ready' | 'error'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 border-t border-border pt-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function WebhookSettings({ webhook }: { webhook: Webhook }) {
  const { t } = useTranslation()
  const { tree, status: treeStatus } = usePageTree()
  const scopePath = useMemo(
    () => (webhook.scopePageId ? flattenTree(tree).find((page) => page.id === webhook.scopePageId)?.path : null),
    [tree, webhook.scopePageId],
  )

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[minmax(0,auto)_minmax(0,1fr)]">
      <dt className="text-muted-foreground">{t('admin.webhooks.columnFormat')}</dt>
      <dd>{t(`admin.webhooks.formats.${webhook.format}`)}</dd>
      <dt className="text-muted-foreground">{t('admin.webhooks.columnEvents')}</dt>
      <dd className="flex min-w-0 flex-wrap gap-x-3 gap-y-1">
        {webhook.events.map((event) => (
          <code key={event} className="font-mono text-xs break-all">
            {event}
          </code>
        ))}
      </dd>
      <dt className="text-muted-foreground">{t('admin.webhooks.form.scopeLabel')}</dt>
      <dd className="break-words">
        {webhook.scopePageId
          ? (scopePath ?? t(treeStatus === 'success' ? 'admin.webhooks.form.scopeMissing' : 'common.loading'))
          : t('pageAccessTree.wholeWiki')}
      </dd>
      <dt className="text-muted-foreground">{t('admin.webhooks.form.includePrivatePagesLabel')}</dt>
      <dd>{t(webhook.includePrivatePages ? 'admin.webhooks.yes' : 'admin.webhooks.no')}</dd>
    </dl>
  )
}

export function AdminWebhookDetail() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [webhook, setWebhook] = useState<Webhook | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [deliveriesKey, setDeliveriesKey] = useState(0)

  useEffect(() => {
    if (!id) return
    const webhookId = id
    let cancelled = false

    async function load() {
      setStatus('loading')
      try {
        const result = await getWebhook(webhookId)
        if (cancelled) return
        setWebhook(result)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  function refreshAfterDelivery() {
    setDeliveriesKey((current) => current + 1)
    if (id) {
      void getWebhook(id).then(setWebhook, () => undefined)
    }
  }

  async function handleDelete() {
    if (!webhook) return
    try {
      await deleteWebhook(webhook.id)
      toast.success(t('admin.webhooks.deleted'))
      navigate('/admin/webhooks')
    } catch (error) {
      toast.error(extractErrorMessage(error, t('admin.webhooks.deleteFailed')))
    }
  }

  return (
    <div className={PAGE_PADDING}>
      <AdminNav />
      <div className="mt-5 mb-4">
        <Link
          to="/admin/webhooks"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> {t('admin.webhooks.backToList')}
        </Link>
      </div>

      {status === 'loading' && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
      {status === 'error' && <p className="text-sm text-destructive">{t('admin.webhooks.loadOneError')}</p>}

      {status === 'ready' && webhook && (
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-xl font-semibold break-words">{webhook.name}</h1>
              <p className="font-mono text-xs break-all text-muted-foreground">{webhook.url}</p>
              <WebhookState webhook={webhook} />
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <WebhookFormDialog
                webhook={webhook}
                trigger={
                  <Button type="button" variant="outline" size="sm">
                    <Pencil /> {t('admin.webhooks.editButton')}
                  </Button>
                }
                onSaved={setWebhook}
              />
              <ConfirmActionButton
                label={
                  <>
                    <Trash2 /> {t('common.delete')}
                  </>
                }
                confirmTitle={t('admin.webhooks.deleteConfirmTitle')}
                confirmDescription={t('admin.webhooks.deleteConfirmDescription', { name: webhook.name })}
                confirmLabel={t('common.delete')}
                variant="destructive"
                onConfirm={handleDelete}
              />
            </div>
          </div>

          <Section title={t('admin.webhooks.settingsSection')}>
            <WebhookSettings webhook={webhook} />
          </Section>

          <Section title={t('admin.webhooks.secret.title')}>
            <p className="text-sm text-muted-foreground">{t('admin.webhooks.secret.description')}</p>
            <WebhookSecretField webhook={webhook} onRotated={setWebhook} />
          </Section>

          <Section title={t('admin.webhooks.test.title')}>
            <p className="text-sm text-muted-foreground">{t('admin.webhooks.test.description')}</p>
            <WebhookTestPanel webhookId={webhook.id} onSent={refreshAfterDelivery} />
          </Section>

          <Section title={t('admin.webhooks.log.title')}>
            <WebhookDeliveriesLog
              key={deliveriesKey}
              webhookId={webhook.id}
              webhookEnabled={webhook.enabled}
              onRedelivered={refreshAfterDelivery}
            />
          </Section>
        </div>
      )}
    </div>
  )
}
