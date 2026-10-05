import { useTranslation } from 'react-i18next'
import { ResponsiveTable, type ResponsiveColumn } from '#components/ResponsiveTable'
import type { AdminAuditLogItem } from '#api/admin-audit-log'
import { formatRelativeTime } from '#utils/relative-time'

interface AdminAuditLogTableProps {
  items: AdminAuditLogItem[]
}

export function AdminAuditLogTable({ items }: AdminAuditLogTableProps) {
  const { t } = useTranslation()

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
      cell: (item) => `${item.targetType}${item.targetId ? ` · ${item.targetId}` : ''}`,
    },
  ]

  return <ResponsiveTable columns={columns} rows={items} rowKey={(item) => item.id} />
}
