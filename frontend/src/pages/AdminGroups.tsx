import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { AdminNav } from '#components/AdminNav'
import { GroupsTable } from '#components/AdminGroups/GroupsTable'
import { CreateGroupDialog } from '#components/AdminGroups/CreateGroupDialog'
import { deleteGroup, listGroups, type GroupSummary } from '#api/groups'
import { extractErrorMessage } from '#lib/api-errors'
import { PAGE_PADDING } from '#utils/page-layout'

type Status = 'loading' | 'ready' | 'error'

export function AdminGroups() {
  const { t } = useTranslation()
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setStatus('loading')
      try {
        const result = await listGroups()
        if (cancelled) return
        setGroups(result)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  function handleRenamed(id: string, name: string, description: string | null) {
    setGroups((current) => current.map((group) => (group.id === id ? { ...group, name, description } : group)))
  }

  async function handleDelete(group: GroupSummary) {
    setPendingGroupId(group.id)
    try {
      await deleteGroup(group.id)
      setGroups((current) => current.filter((item) => item.id !== group.id))
      toast.success(t('admin.groups.deleted'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('admin.groups.deleteFailed')))
    } finally {
      setPendingGroupId(null)
    }
  }

  return (
    <div className={PAGE_PADDING}>
      <AdminNav />
      <div className="mt-5 mb-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div />
        <CreateGroupDialog onCreated={(group) => setGroups((current) => [...current, group])} />
      </div>
      {status === 'loading' && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
      {status === 'error' && <p className="text-sm text-destructive">{t('admin.groups.loadError')}</p>}
      {status === 'ready' && groups.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('admin.groups.empty')}</p>
      )}
      {status === 'ready' && groups.length > 0 && (
        <GroupsTable groups={groups} pendingGroupId={pendingGroupId} onRenamed={handleRenamed} onDelete={handleDelete} />
      )}
    </div>
  )
}
