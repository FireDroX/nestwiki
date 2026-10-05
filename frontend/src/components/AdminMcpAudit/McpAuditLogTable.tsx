import { useTranslation } from 'react-i18next'
import { Badge } from '#components/ui/badge'
import { ResponsiveTable, type ResponsiveColumn } from '#components/ResponsiveTable'
import type { McpAuditLogItem } from '#api/admin-mcp'
import { formatRelativeTime } from '#utils/relative-time'

interface McpAuditLogTableProps {
  items: McpAuditLogItem[]
  onSelect: (item: McpAuditLogItem) => void
}

export function McpAuditLogTable({ items, onSelect }: McpAuditLogTableProps) {
  const { t } = useTranslation()

  const columns: ResponsiveColumn<McpAuditLogItem>[] = [
    { id: 'key', header: t('admin.mcpAudit.columnKey'), cell: (item) => item.apiKeyName },
    { id: 'tool', header: t('admin.mcpAudit.columnTool'), primary: true, className: 'font-mono', cell: (item) => item.toolName },
    {
      id: 'status',
      header: t('admin.mcpAudit.columnStatus'),
      cell: (item) =>
        item.success ? (
          <Badge variant="outline">{t('admin.mcpAudit.statusSuccess')}</Badge>
        ) : (
          <Badge variant="destructive">{t('admin.mcpAudit.statusFailure')}</Badge>
        ),
    },
    {
      id: 'date',
      header: t('admin.mcpAudit.columnDate'),
      className: 'text-muted-foreground',
      cell: (item) => formatRelativeTime(item.createdAt),
    },
  ]

  return <ResponsiveTable columns={columns} rows={items} rowKey={(item) => item.id} onRowClick={onSelect} />
}
