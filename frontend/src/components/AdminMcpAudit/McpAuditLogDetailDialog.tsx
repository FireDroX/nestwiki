import { useTranslation } from 'react-i18next'
import { CodeBlock } from '#components/CodeBlock'
import { Badge } from '#components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '#components/ui/dialog'
import type { McpAuditLogItem } from '#api/admin-mcp'
import { formatDateTime } from '#utils/relative-time'

const PAYLOAD_CLASS_NAME = '[&_pre]:max-h-64 [&_pre]:overflow-auto [&_pre]:p-3 [&_pre]:text-xs'

interface McpAuditLogDetailDialogProps {
  item: McpAuditLogItem | null
  onClose: () => void
}

export function McpAuditLogDetailDialog({ item, onClose }: McpAuditLogDetailDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={item !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{item?.toolName}</span>
            {item &&
              (item.success ? (
                <Badge variant="outline">{t('admin.mcpAudit.statusSuccess')}</Badge>
              ) : (
                <Badge variant="destructive">{t('admin.mcpAudit.statusFailure')}</Badge>
              ))}
          </DialogTitle>
          <DialogDescription>
            {item && `${item.apiKeyName} — ${formatDateTime(item.createdAt)}`}
          </DialogDescription>
        </DialogHeader>

        {item && !item.success && item.errorMessage && (
          <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{item.errorMessage}</p>
        )}

        {item && (
          <div className="min-w-0 space-y-3">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">
                {t('admin.mcpAudit.detailInput')}
              </p>
              <CodeBlock language="json" code={JSON.stringify(item.input, null, 2)} className={PAYLOAD_CLASS_NAME} />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">
                {t('admin.mcpAudit.detailOutput')}
              </p>
              <CodeBlock language="json" code={JSON.stringify(item.output, null, 2)} className={PAYLOAD_CLASS_NAME} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
