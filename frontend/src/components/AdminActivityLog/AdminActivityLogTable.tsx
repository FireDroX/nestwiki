import { useTranslation } from 'react-i18next'
import { ResponsiveTable, type ResponsiveColumn } from '#components/ResponsiveTable'
import type { UserActivityLogItem } from '#api/user-activity-log'
import { formatRelativeTime } from '#utils/relative-time'

interface AdminActivityLogTableProps {
  items: UserActivityLogItem[]
}

export function AdminActivityLogTable({ items }: AdminActivityLogTableProps) {
  const { t } = useTranslation()

  const columns: ResponsiveColumn<UserActivityLogItem>[] = [
    {
      id: 'date',
      header: t('admin.activityLog.columnDate'),
      className: 'text-muted-foreground',
      cell: (item) => formatRelativeTime(item.createdAt),
    },
    { id: 'user', header: t('admin.activityLog.columnUser'), cell: (item) => item.userDisplayName },
    {
      id: 'action',
      header: t('admin.activityLog.columnAction'),
      primary: true,
      className: 'font-mono',
      cell: (item) => t(`admin.activityLog.actions.${item.action}`, { defaultValue: item.action }),
    },
    {
      id: 'target',
      header: t('admin.activityLog.columnTarget'),
      className: 'font-mono text-muted-foreground',
      cell: (item) => `${item.targetType}${item.targetId ? ` · ${item.targetId}` : ''}`,
    },
  ]

  return <ResponsiveTable columns={columns} rows={items} rowKey={(item) => item.id} />
}
