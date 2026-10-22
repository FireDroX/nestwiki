import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ResponsiveTable, type ResponsiveColumn } from '#components/ResponsiveTable'
import { DeliveryStatusBadge, WebhookState } from '#components/AdminWebhooks/WebhookBadges'
import type { WebhookSummary } from '#api/webhooks'
import { formatDateTime } from '#utils/relative-time'
import { webhookHost } from '#utils/webhook-url'

interface WebhooksTableProps {
  webhooks: WebhookSummary[]
}

export function WebhooksTable({ webhooks }: WebhooksTableProps) {
  const { t } = useTranslation()

  const columns: ResponsiveColumn<WebhookSummary>[] = [
    {
      id: 'name',
      header: t('admin.webhooks.columnName'),
      primary: true,
      cell: (webhook) => (
        <Link to={`/admin/webhooks/${webhook.id}`} className="block min-w-0 font-medium break-words hover:underline">
          {webhook.name}
        </Link>
      ),
    },
    {
      id: 'host',
      header: t('admin.webhooks.columnHost'),
      className: 'font-mono text-xs break-all whitespace-normal text-muted-foreground',
      cell: (webhook) => webhookHost(webhook.url),
    },
    {
      id: 'format',
      header: t('admin.webhooks.columnFormat'),
      cell: (webhook) => t(`admin.webhooks.formats.${webhook.format}`),
    },
    {
      id: 'events',
      header: t('admin.webhooks.columnEvents'),
      className: 'text-muted-foreground',
      cell: (webhook) => t('admin.webhooks.eventsCount', { count: webhook.events.length }),
    },
    {
      id: 'state',
      header: t('admin.webhooks.columnState'),
      className: 'whitespace-normal',
      cell: (webhook) => <WebhookState webhook={webhook} />,
    },
    {
      id: 'lastDelivery',
      header: t('admin.webhooks.columnLastDelivery'),
      cell: (webhook) =>
        webhook.lastDelivery ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">{formatDateTime(webhook.lastDelivery.createdAt)}</span>
            <DeliveryStatusBadge status={webhook.lastDelivery.status} />
          </div>
        ) : (
          <span className="text-muted-foreground">{t('admin.webhooks.neverDelivered')}</span>
        ),
    },
  ]

  return (
    <ResponsiveTable
      columns={columns}
      rows={webhooks}
      rowKey={(webhook) => webhook.id}
      empty={<p className="text-sm text-muted-foreground">{t('admin.webhooks.empty')}</p>}
    />
  )
}
