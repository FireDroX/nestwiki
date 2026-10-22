import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '#components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#components/ui/select'
import { ResponsiveTable, type ResponsiveColumn } from '#components/ResponsiveTable'
import { DeliveryStatusBadge } from '#components/AdminWebhooks/WebhookBadges'
import { WebhookDeliveryDialog } from '#components/AdminWebhooks/WebhookDeliveryDialog'
import {
  listWebhookDeliveries,
  WEBHOOK_DELIVERY_STATUSES,
  type WebhookDelivery,
  type WebhookDeliveryStatus,
} from '#api/webhooks'
import { formatDateTime } from '#utils/relative-time'

const PAGE_LIMIT = 20
const ALL_STATUSES = 'all'

type Status = 'loading' | 'ready' | 'error'

interface WebhookDeliveriesLogProps {
  webhookId: string
  webhookEnabled: boolean
  refreshKey: number
  onRedelivered: () => void
}

export function WebhookDeliveriesLog({ webhookId, webhookEnabled, refreshKey, onRedelivered }: WebhookDeliveriesLogProps) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<WebhookDeliveryStatus | undefined>(undefined)
  const [items, setItems] = useState<WebhookDelivery[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<Status>('loading')
  const [selected, setSelected] = useState<WebhookDelivery | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setStatus('loading')
      try {
        const result = await listWebhookDeliveries(webhookId, { status: statusFilter, page, limit: PAGE_LIMIT })
        if (cancelled) return
        setItems(result.items)
        setTotal(result.total)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [webhookId, statusFilter, page, refreshKey, reloadKey])

  function handleFilterChange(value: string) {
    setStatusFilter(value === ALL_STATUSES ? undefined : (value as WebhookDeliveryStatus))
    setPage(1)
  }

  function handleRedelivered() {
    setSelected(null)
    setPage(1)
    setReloadKey((current) => current + 1)
    onRedelivered()
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  const columns: ResponsiveColumn<WebhookDelivery>[] = [
    {
      id: 'date',
      header: t('admin.webhooks.log.columnDate'),
      primary: true,
      cell: (delivery) => (
        <button
          type="button"
          className="text-left font-medium hover:underline"
          onClick={(event) => {
            event.stopPropagation()
            setSelected(delivery)
          }}
        >
          {formatDateTime(delivery.createdAt)}
        </button>
      ),
    },
    {
      id: 'event',
      header: t('admin.webhooks.log.columnEvent'),
      className: 'font-mono text-xs break-all whitespace-normal',
      cell: (delivery) => delivery.event,
    },
    {
      id: 'status',
      header: t('admin.webhooks.columnStatus'),
      cell: (delivery) => <DeliveryStatusBadge status={delivery.status} />,
    },
    {
      id: 'code',
      header: t('admin.webhooks.columnStatusCode'),
      className: 'text-muted-foreground',
      cell: (delivery) => delivery.lastStatusCode ?? '—',
    },
    {
      id: 'duration',
      header: t('admin.webhooks.columnDuration'),
      className: 'text-muted-foreground',
      cell: (delivery) =>
        delivery.durationMs !== null ? t('admin.webhooks.durationMs', { count: delivery.durationMs }) : '—',
    },
    {
      id: 'attempts',
      header: t('admin.webhooks.log.columnAttempts'),
      className: 'text-muted-foreground',
      cell: (delivery) => delivery.attempts,
    },
    {
      id: 'nextAttempt',
      header: t('admin.webhooks.log.columnNextAttempt'),
      className: 'text-muted-foreground',
      cell: (delivery) => (delivery.nextAttemptAt ? formatDateTime(delivery.nextAttemptAt) : '—'),
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Select value={statusFilter ?? ALL_STATUSES} onValueChange={handleFilterChange}>
        <SelectTrigger className="w-full sm:w-56" aria-label={t('admin.webhooks.log.statusFilter')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_STATUSES}>{t('admin.webhooks.log.allStatuses')}</SelectItem>
          {WEBHOOK_DELIVERY_STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {t(`admin.webhooks.deliveryStatus.${value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {status === 'loading' && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
      {status === 'error' && <p className="text-sm text-destructive">{t('admin.webhooks.log.loadError')}</p>}
      {status === 'ready' && (
        <>
          <ResponsiveTable
            columns={columns}
            rows={items}
            rowKey={(delivery) => delivery.id}
            onRowClick={setSelected}
            empty={<p className="text-sm text-muted-foreground">{t('admin.webhooks.log.empty')}</p>}
          />
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t('common.previous')}
              </Button>
              <span>{t('common.pageOf', { page, total: totalPages })}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                {t('common.next')}
              </Button>
            </div>
          )}
        </>
      )}

      <WebhookDeliveryDialog
        delivery={selected}
        webhookEnabled={webhookEnabled}
        onClose={() => setSelected(null)}
        onRedelivered={handleRedelivered}
      />
    </div>
  )
}
