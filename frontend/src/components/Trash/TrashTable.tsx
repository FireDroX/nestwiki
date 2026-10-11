import { RotateCcw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ResponsiveTable, type ResponsiveColumn } from '#components/ResponsiveTable'
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
import { Button } from '#components/ui/button'
import type { TrashEntry } from '#api/pages'
import { formatRelativeTime } from '#utils/relative-time'

interface TrashTableProps {
  entries: TrashEntry[]
  isAdmin: boolean
  pendingId: string | null
  onRestore: (id: string) => void
  onPurge: (id: string) => void
}

export function TrashTable({ entries, isAdmin, pendingId, onRestore, onPurge }: TrashTableProps) {
  const { t } = useTranslation()

  const columns: ResponsiveColumn<TrashEntry>[] = [
    {
      id: 'page',
      header: t('trash.columnPage'),
      primary: true,
      cell: (entry) => (
        <div className="flex flex-col">
          <span className="font-medium">{entry.title}</span>
          <span className="font-mono text-xs text-muted-foreground">{entry.path}</span>
        </div>
      ),
    },
    {
      id: 'deletedBy',
      header: t('trash.columnDeletedBy'),
      cell: (entry) => entry.deletedBy?.displayName ?? t('trash.unknownDeleter'),
    },
    {
      id: 'deletedAt',
      header: t('trash.columnDeletedAt'),
      className: 'text-muted-foreground',
      cell: (entry) => formatRelativeTime(entry.deletedAt),
    },
    {
      id: 'descendants',
      header: t('trash.columnDescendants'),
      className: 'text-muted-foreground',
      cell: (entry) => entry.descendantCount,
    },
  ]

  return (
    <ResponsiveTable
      columns={columns}
      rows={entries}
      rowKey={(entry) => entry.id}
      empty={<p className="text-sm text-muted-foreground">{t('trash.empty')}</p>}
      actions={(entry) => (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pendingId === entry.id}
            onClick={() => onRestore(entry.id)}
          >
            <RotateCcw /> {t('trash.restore')}
          </Button>
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" size="sm" disabled={pendingId === entry.id}>
                  <Trash2 /> {t('trash.purge')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('trash.purgeConfirmTitle', { title: entry.title })}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('trash.purgeConfirmDescription', { count: entry.descendantCount })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => onPurge(entry.id)}>
                    {t('common.delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
    />
  )
}
