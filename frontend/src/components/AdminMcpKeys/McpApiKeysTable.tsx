import { Ban } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#components/ui/alert-dialog'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { ResponsiveTable, type ResponsiveColumn } from '#components/ResponsiveTable'
import type { McpApiKeySummary } from '#api/admin-mcp'
import { cn } from '#lib/utils'
import { formatRelativeTime } from '#utils/relative-time'

interface McpApiKeysTableProps {
  keys: McpApiKeySummary[]
  pendingKeyId: string | null
  onRevoke: (key: McpApiKeySummary) => void
}

interface RevokeKeyButtonProps {
  apiKey: McpApiKeySummary
  pending: boolean
  onRevoke: (key: McpApiKeySummary) => void
}

function RevokeKeyButton({ apiKey, pending, onRevoke }: RevokeKeyButtonProps) {
  const { t } = useTranslation()
  const isRevoked = apiKey.revokedAt !== null

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" disabled={isRevoked || pending}>
          <Ban />
          <span className="sr-only">{t('admin.mcpKeys.revokeSr', { name: apiKey.name })}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('admin.mcpKeys.revokeConfirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('admin.mcpKeys.revokeConfirmDescription', { name: apiKey.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => onRevoke(apiKey)}>
            {t('admin.mcpKeys.revokeConfirmAction')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function McpApiKeysTable({ keys, pendingKeyId, onRevoke }: McpApiKeysTableProps) {
  const { t } = useTranslation()

  const columns: ResponsiveColumn<McpApiKeySummary>[] = [
    { id: 'name', header: t('admin.mcpKeys.columnName'), primary: true, className: 'font-medium', cell: (key) => key.name },
    {
      id: 'scopes',
      header: t('admin.mcpKeys.columnScopes'),
      cell: (key) => (
        <div className="flex flex-wrap gap-1">
          {key.scopes.map((scope) => (
            <Badge key={scope} variant="secondary" className="font-mono">
              {scope}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: 'lastUsed',
      header: t('admin.mcpKeys.columnLastUsed'),
      className: 'text-muted-foreground',
      cell: (key) => (key.lastUsedAt ? formatRelativeTime(key.lastUsedAt) : t('admin.mcpKeys.neverUsed')),
    },
    {
      id: 'status',
      header: t('admin.mcpKeys.columnStatus'),
      cell: (key) =>
        key.revokedAt !== null ? (
          <Badge variant="destructive">{t('admin.mcpKeys.statusRevoked')}</Badge>
        ) : (
          <Badge variant="outline">{t('admin.mcpKeys.statusActive')}</Badge>
        ),
    },
  ]

  return (
    <ResponsiveTable
      columns={columns}
      rows={keys}
      rowKey={(key) => key.id}
      rowClassName={(key) => cn(key.revokedAt !== null && 'opacity-50')}
      actions={(key) => <RevokeKeyButton apiKey={key} pending={pendingKeyId === key.id} onRevoke={onRevoke} />}
    />
  )
}
