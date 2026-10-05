import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AdminNav } from '#components/AdminNav'
import { AdminAuditLogFilters } from '#components/AdminAuditLog/AdminAuditLogFilters'
import { AdminAuditLogTable } from '#components/AdminAuditLog/AdminAuditLogTable'
import { Button } from '#components/ui/button'
import { listAuditLog, type AdminAuditLogItem } from '#api/admin-audit-log'
import { listUsers, type AdminUser } from '#api/users'
import { PAGE_PADDING } from '#utils/page-layout'

const PAGE_LIMIT = 50

type Status = 'loading' | 'ready' | 'error'

function parsePage(raw: string | null): number {
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

export function AdminAuditLog() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const adminId = searchParams.get('adminId') ?? undefined
  const action = searchParams.get('action') ?? undefined
  const dateFrom = searchParams.get('dateFrom') ?? undefined
  const dateTo = searchParams.get('dateTo') ?? undefined
  const search = searchParams.get('search') ?? undefined
  const page = parsePage(searchParams.get('page'))

  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [items, setItems] = useState<AdminAuditLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    void listUsers()
      .then((result) => setAdmins(result.items))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setStatus('loading')
      try {
        const result = await listAuditLog({ adminId, action, dateFrom, dateTo, search, page, limit: PAGE_LIMIT })
        if (cancelled) return
        setItems(result.items)
        setTotal(result.total)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [adminId, action, dateFrom, dateTo, search, page])

  function updateParams(next: {
    adminId?: string
    action?: string
    dateFrom?: string
    dateTo?: string
    search?: string
    page?: number
  }) {
    const params = new URLSearchParams(searchParams)
    const filterKeys = ['adminId', 'action', 'dateFrom', 'dateTo', 'search'] as const
    const touchesFilters = filterKeys.some((key) => key in next)
    if (touchesFilters) {
      for (const key of filterKeys) {
        if (!(key in next)) continue
        if (next[key]) {
          params.set(key, next[key] as string)
        } else {
          params.delete(key)
        }
      }
      params.delete('page')
    }
    if (next.page !== undefined) {
      params.set('page', String(next.page))
    }
    setSearchParams(params)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  return (
    <div className={PAGE_PADDING}>
      <AdminNav />
      <div className="mt-5 mb-4">
        <AdminAuditLogFilters
          admins={admins}
          adminId={adminId}
          action={action}
          dateFrom={dateFrom}
          dateTo={dateTo}
          search={search}
          onChange={(next) => updateParams(next)}
        />
      </div>

      {status === 'loading' && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
      {status === 'error' && <p className="text-sm text-destructive">{t('admin.auditLog.loadError')}</p>}
      {status === 'ready' && items.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('admin.auditLog.empty')}</p>
      )}
      {status === 'ready' && items.length > 0 && (
        <>
          <AdminAuditLogTable items={items} />
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateParams({ page: page - 1 })}
              >
                {t('common.previous')}
              </Button>
              <span>{t('common.pageOf', { page, total: totalPages })}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => updateParams({ page: page + 1 })}
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
