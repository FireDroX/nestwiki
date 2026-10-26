import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AdminNav } from '#components/AdminNav'
import { BrokenLinksTable } from '#components/AdminBrokenLinks/BrokenLinksTable'
import { Button } from '#components/ui/button'
import { listBrokenLinks, type BrokenPageLink } from '#api/admin-links'
import { PAGE_PADDING } from '#utils/page-layout'

const PAGE_LIMIT = 50

type Status = 'loading' | 'ready' | 'error'

function parsePage(raw: string | null): number {
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

export function AdminBrokenLinks() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))
  const [items, setItems] = useState<BrokenPageLink[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setStatus('loading')
      try {
        const result = await listBrokenLinks({ page, limit: PAGE_LIMIT })
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
  }, [page])

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(next))
    setSearchParams(params)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  return (
    <div className={PAGE_PADDING}>
      <AdminNav />
      <div className="mt-5">
        {status === 'loading' && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
        {status === 'error' && <p className="text-sm text-destructive">{t('admin.brokenLinks.loadError')}</p>}
        {status === 'ready' && (
          <>
            <BrokenLinksTable items={items} />
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                >
                  {t('common.previous')}
                </Button>
                <span>{t('common.pageOf', { page, total: totalPages })}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                >
                  {t('common.next')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
