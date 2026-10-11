import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { UserRole } from '#api/auth'
import { listTrash, purgePage, restorePage, type TrashEntry } from '#api/pages'
import { TrashTable } from '#components/Trash/TrashTable'
import { useAuth } from '#hooks/useAuth'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { usePageTree } from '#hooks/usePageTree'
import { extractErrorMessage } from '#lib/api-errors'
import { PAGE_PADDING } from '#utils/page-layout'

type Status = 'loading' | 'ready' | 'error'

export function Trash() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { refresh: refreshTree } = usePageTree()
  const [entries, setEntries] = useState<TrashEntry[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [pendingId, setPendingId] = useState<string | null>(null)
  useDocumentTitle(t('trash.title'))

  useEffect(() => {
    let cancelled = false
    listTrash()
      .then((result) => {
        if (cancelled) return
        setEntries(result)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function runOnEntry(id: string, action: (id: string) => Promise<void>, successMessage: string) {
    setPendingId(id)
    try {
      await action(id)
      setEntries((current) => current.filter((entry) => entry.id !== id))
      toast.success(successMessage)
      await refreshTree()
    } catch (error) {
      toast.error(extractErrorMessage(error))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className={PAGE_PADDING}>
      <div className="mb-5 space-y-1">
        <h1 className="text-2xl font-semibold">{t('trash.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('trash.description')}</p>
      </div>
      {status === 'loading' && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
      {status === 'error' && <p className="text-sm text-destructive">{t('trash.loadError')}</p>}
      {status === 'ready' && (
        <TrashTable
          entries={entries}
          isAdmin={user?.role === UserRole.Admin}
          pendingId={pendingId}
          onRestore={(id) => void runOnEntry(id, restorePage, t('trash.restored'))}
          onPurge={(id) => void runOnEntry(id, purgePage, t('trash.purged'))}
        />
      )}
    </div>
  )
}
