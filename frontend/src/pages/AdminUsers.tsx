import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { AdminNav } from '#components/AdminNav'
import { Button } from '#components/ui/button'
import { UsersTable } from '#components/AdminUsers/UsersTable'
import { UsersFilters, type UsersFiltersValue } from '#components/AdminUsers/UsersFilters'
import { UsersBulkActionsBar } from '#components/AdminUsers/UsersBulkActionsBar'
import { CreateUserDialog } from '#components/AdminUsers/CreateUserDialog'
import { deleteUser, listUsers, type AdminUser } from '#api/users'
import { listGroups, type GroupSummary } from '#api/groups'
import { useAuth } from '#hooks/useAuth'
import { extractErrorMessage } from '#lib/api-errors'

type Status = 'loading' | 'ready' | 'error'
const PAGE_LIMIT = 20
const SEARCH_DEBOUNCE_MS = 300

export function AdminUsers() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [filters, setFilters] = useState<UsersFiltersValue>({
    search: '',
    role: undefined,
    groupId: undefined,
    active: undefined,
  })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    listGroups()
      .then(setGroups)
      .catch(() => setGroups([]))
  }, [reloadToken])

  useEffect(() => {
    let cancelled = false
    const timeout = setTimeout(
      () => {
        setStatus('loading')
        listUsers({ page, limit: PAGE_LIMIT, search: filters.search || undefined, role: filters.role, groupId: filters.groupId, active: filters.active })
          .then((result) => {
            if (cancelled) return
            setUsers(result.items)
            setTotal(result.total)
            setStatus('ready')
          })
          .catch(() => {
            if (!cancelled) setStatus('error')
          })
      },
      filters.search ? SEARCH_DEBOUNCE_MS : 0,
    )
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters.search, filters.role, filters.groupId, filters.active, reloadToken])

  useEffect(() => {
    setPage(1)
  }, [filters.search, filters.role, filters.groupId, filters.active])

  useEffect(() => {
    setSelectedUserIds([])
  }, [page, filters])

  function reload() {
    setReloadToken((token) => token + 1)
  }

  async function handleDelete(user: AdminUser) {
    setPendingUserId(user.id)
    try {
      await deleteUser(user.id)
      toast.success(t('admin.users.userDeleted'))
      reload()
    } catch (error) {
      toast.error(extractErrorMessage(error, t('admin.users.userDeleteFailed')))
    } finally {
      setPendingUserId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  return (
    <div className="p-8">
      <AdminNav />
      <div className="mt-5 mb-4 flex items-center justify-between gap-3">
        <UsersFilters value={filters} groups={groups} onChange={setFilters} />
        <CreateUserDialog onCreated={() => reload()} />
      </div>

      <div className="mb-4">
        <UsersBulkActionsBar
          selectedUserIds={selectedUserIds}
          onDone={() => {
            setSelectedUserIds([])
            reload()
          }}
        />
      </div>

      {status === 'loading' && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
      {status === 'error' && <p className="text-sm text-destructive">{t('admin.users.loadError')}</p>}
      {status === 'ready' && users.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('admin.users.empty')}</p>
      )}
      {status === 'ready' && users.length > 0 && (
        <>
          <UsersTable
            users={users}
            currentUserId={currentUser?.id}
            pendingUserId={pendingUserId}
            selectedUserIds={selectedUserIds}
            onSelectedChange={setSelectedUserIds}
            onDelete={handleDelete}
          />
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t('common.previous')}
              </Button>
              <span className="text-sm text-muted-foreground">{t('common.pageOf', { page, total: totalPages })}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                {t('common.next')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
