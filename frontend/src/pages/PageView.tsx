import { Link, useParams } from 'react-router'
import { useEffect, useMemo, useState } from 'react'
import { History, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '#components/ui/button'
import { MarkdownRenderer } from '#components/MarkdownRenderer'
import { Skeleton } from '#components/ui/skeleton'
import { PageBreadcrumb } from '#components/layout/PageBreadcrumb'
import { CommentThread } from '#components/PageView/CommentThread'
import { ContributorsList } from '#components/PageView/ContributorsList'
import { FollowButton } from '#components/PageView/FollowButton'
import { PageTagList } from '#components/PageView/PageTagList'
import { PageAccessPanel } from '#components/PageAccessPanel/PageAccessPanel'
import { useAuth } from '#hooks/useAuth'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { usePage } from '#hooks/usePage'
import { usePageRoom } from '#hooks/usePageRoom'
import { usePageTags } from '#hooks/usePageTags'
import { usePermissions } from '#hooks/usePermissions'
import { getRealtimeSocket } from '#lib/realtime-client'

function PageViewSkeleton() {
  return (
    <div className="space-y-6 p-8">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <Skeleton className="h-4 w-40" />
          <div className="flex shrink-0 gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  )
}

interface PageStatusMessageProps {
  title: string
  description: string
}

function PageStatusMessage({ title, description }: PageStatusMessageProps) {
  const { t } = useTranslation()
  return (
    <div className="flex max-w-3xl flex-col items-start gap-4 p-8">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
      <Button asChild>
        <Link to="/">{t('pageView.backHome')}</Link>
      </Button>
    </div>
  )
}

export function PageView() {
  const { t } = useTranslation()
  const params = useParams()
  const pathSegments = useMemo(() => (params['*'] ?? '').split('/').filter(Boolean), [params])
  const { status, page, refresh } = usePage(pathSegments)
  const [hasNewVersion, setHasNewVersion] = useState(false)
  usePageRoom(page?.id)
  const { tags } = usePageTags(page?.id)
  const { user } = useAuth()
  const { canOnPage } = usePermissions()
  const canEdit = canOnPage(page, 'page.edit')
  const canManageAccess = canOnPage(page, 'page.manage_permissions')
  useDocumentTitle(page?.title)

  useEffect(() => {
    setHasNewVersion(false)
    if (!page) {
      return
    }
    const currentPageId = page.id
    const socket = getRealtimeSocket()
    function handleVersionCreated(payload: { pageId: string }) {
      if (payload.pageId === currentPageId) {
        setHasNewVersion(true)
      }
    }
    socket.on('page:version-created', handleVersionCreated)
    return () => {
      socket.off('page:version-created', handleVersionCreated)
    }
  }, [page])

  async function handleReload() {
    await refresh()
    setHasNewVersion(false)
  }

  if (status === 'loading') {
    return <PageViewSkeleton />
  }

  if (status === 'notFound') {
    return (
      <PageStatusMessage
        title={t('pageView.notFoundTitle')}
        description={t('pageView.notFoundDescription')}
      />
    )
  }

  if (status === 'forbidden') {
    return (
      <PageStatusMessage
        title={t('pageView.forbiddenTitle')}
        description={t('pageView.forbiddenDescription')}
      />
    )
  }

  if (status === 'error' || !page) {
    return (
      <PageStatusMessage
        title={t('pageView.errorTitle')}
        description={t('pageView.errorDescription')}
      />
    )
  }

  return (
    <article className="space-y-6 p-8">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <PageBreadcrumb title={page.title} parentId={page.parentId} />
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            {user && <FollowButton key={page.id} pageId={page.id} initialFollowed={page.isFollowed} />}
            <Button variant="outline" size="sm" asChild>
              <Link to={`/history/${pathSegments.join('/')}`}>
                <History /> {t('pageView.history')}
              </Link>
            </Button>
            {canEdit && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/edit/${pathSegments.join('/')}`}>
                  <Pencil /> {t('pageView.edit')}
                </Link>
              </Button>
            )}
            {canManageAccess && <PageAccessPanel pageId={page.id} availableActions={page.permissions} />}
          </div>
        </div>
        <PageTagList tags={tags} />
      </div>
      {hasNewVersion && (
        <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
          <span>{t('pageView.newVersionBanner')}</span>
          <Button size="sm" variant="outline" onClick={handleReload}>
            {t('pageView.reloadButton')}
          </Button>
        </div>
      )}
      <MarkdownRenderer content={page.content} mode="full" />
      {page.commentsEnabled && <CommentThread pageId={page.id} />}
      <ContributorsList pageId={page.id} />
    </article>
  )
}
