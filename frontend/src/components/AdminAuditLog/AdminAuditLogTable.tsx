import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ResponsiveTable, type ResponsiveColumn } from '#components/ResponsiveTable'
import type { AdminAuditLogItem } from '#api/admin-audit-log'
import { LogTargetCell } from '#components/LogTargetCell'
import { useLogTargetLink } from '#hooks/useLogTargetLink'
import { formatRelativeTime } from '#utils/relative-time'

interface AdminAuditLogTableProps {
  items: AdminAuditLogItem[]
}

export function AdminAuditLogTable({ items }: AdminAuditLogTableProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const linkFor = useLogTargetLink()

  const columns: ResponsiveColumn<AdminAuditLogItem>[] = [
    {
      id: 'date',
      header: t('admin.auditLog.columnDate'),
      className: 'text-muted-foreground',
      cell: (item) => formatRelativeTime(item.createdAt),
    },
    { id: 'admin', header: t('admin.auditLog.columnAdmin'), cell: (item) => item.adminDisplayName },
    {
      id: 'action',
      header: t('admin.auditLog.columnAction'),
      primary: true,
      className: 'font-mono',
      cell: (item) => t(`admin.auditLog.actions.${item.action}`, { defaultValue: item.action }),
    },
    {
      id: 'target',
      header: t('admin.auditLog.columnTarget'),
      className: 'font-mono text-muted-foreground',
      cell: (item) => <LogTargetCell targetType={item.targetType} targetId={item.targetId} href={linkFor(item)} />,
    },
  ]

  function handleRowClick(item: AdminAuditLogItem) {
    const href = linkFor(item)
    if (href) navigate(href)
  }

  return (
    <ResponsiveTable
      columns={columns}
      rows={items}
      rowKey={(item) => item.id}
      rowClassName={(item) => (linkFor(item) ? undefined : 'cursor-default')}
      onRowClick={handleRowClick}
    />
  )
}
