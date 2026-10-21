import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { History, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { deletePage } from '#api/pages'
import { Button } from '#components/ui/button'
import { MarkdownRenderer } from '#components/MarkdownRenderer'
import { Skeleton } from '#components/ui/skeleton'
import { PageBreadcrumb } from '#components/layout/PageBreadcrumb'
import { CommentThread } from '#components/PageView/CommentThread'
import { DeletePageDialog } from '#components/PageView/DeletePageDialog'
import { ExportMenu } from '#components/PageView/ExportMenu'
import { ContributorsList } from '#components/PageView/ContributorsList'
import { FollowButton } from '#components/PageView/FollowButton'
import { PageBacklinks } from '#components/PageView/PageBacklinks'
import { PageTagList } from '#components/PageView/PageTagList'
import {
  TableOfContentsCollapsible,
  TableOfContentsPrint,
  TableOfContentsSidebar,
} from '#components/PageView/TableOfContents'
import { PageAccessPanel } from '#components/PageAccessPanel/PageAccessPanel'
import { useActiveHeading } from '#hooks/useActiveHeading'
import { useAuth } from '#hooks/useAuth'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { usePage } from '#hooks/usePage'
import { usePageRoom } from '#hooks/usePageRoom'
import { usePageTags } from '#hooks/usePageTags'
import { usePageTree } from '#hooks/usePageTree'
import { usePermissions } from '#hooks/usePermissions'
import { usePrintPreparation } from '#hooks/usePrintPreparation'
import { usePrintShortcut } from '#lib/print-mode'
import { useScrollToHash } from '#hooks/useScrollToHash'
import { useTableOfContents } from '#hooks/useTableOfContents'
import { extractErrorMessage } from '#lib/api-errors'
import { getRealtimeSocket } from '#lib/realtime-client'
import { PAGE_PADDING } from '#utils/page-layout'
import { collectSubtreeIds } from '#utils/page-tree'
import { shouldShowTableOfContents } from '#utils/table-of-contents'
import { cn } from '#lib/utils'

function PageViewSkeleton() {
  return (
    <div className={cn(PAGE_PADDING, 'space-y-6')}>
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
    <div className={cn(PAGE_PADDING, 'flex max-w-3xl flex-col items-start gap-4')}>
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
  const [searchParams] = useSearchParams()
  const pathSegments = useMemo(() => (params['*'] ?? '').split('/').filter(Boolean), [params])
  const { status, page, refresh } = usePage(pathSegments)
  const [hasNewVersion, setHasNewVersion] = useState(false)
  usePageRoom(page?.id)
  const { tags } = usePageTags(page?.id)
  const { user } = useAuth()
  const { canOnPage } = usePermissions()
  const canEdit = canOnPage(page, 'page.edit')
  const canManageAccess = canOnPage(page, 'page.manage_permissions')
  const canDelete = canOnPage(page, 'page.delete')
  const { status: treeStatus, tree, refresh: refreshTree } = usePageTree()
  const navigate = useNavigate()
  const [isDeleting, setIsDeleting] = useState(false)
  const descendantCount = page ? collectSubtreeIds(tree, page.id).length - 1 : 0
  useDocumentTitle(page?.title)
  const contentRef = useRef<HTMLDivElement>(null)
  const headings = useTableOfContents(contentRef, page?.content)
  const activeHeadingId = useActiveHeading(headings)
  useScrollToHash(page?.content)
  usePrintPreparation(user?.displayName)
  usePrintShortcut()

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

  const hasTableOfContents = shouldShowTableOfContents(headings)

  async function handleReload() {
    await refresh()
    setHasNewVersion(false)
  }

  async function handleDelete() {
    if (!page) {
      return
    }
    setIsDeleting(true)
    try {
      await deletePage(page.id, descendantCount > 0)
      toast.success(t('pageView.deleted'))
      await refreshTree()
      const parentSegments = pathSegments.slice(0, -1)
      navigate(parentSegments.length > 0 ? `/pages/${parentSegments.join('/')}` : '/')
    } catch (error) {
      toast.error(extractErrorMessage(error))
      await refreshTree()
    } finally {
      setIsDeleting(false)
    }
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
    <div className="flex min-h-full">
      <article className={cn(PAGE_PADDING, 'min-w-0 flex-1 space-y-6')}>
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 print:hidden">
            <PageBreadcrumb title={page.title} parentId={page.parentId} />
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              {user && <FollowButton key={`follow-${page.id}`} pageId={page.id} initialFollowed={page.isFollowed} />}
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
              {canDelete && (
                <DeletePageDialog
                  title={page.title}
                  descendantCount={descendantCount}
                  pending={isDeleting || treeStatus !== 'success'}
                  onConfirm={handleDelete}
                />
              )}
              <ExportMenu pageId={page.id} pathSegments={pathSegments} hasChildren={descendantCount > 0} />
              {canManageAccess && (
                <PageAccessPanel
                  key={`access-${page.id}`}
                  pageId={page.id}
                  availableActions={page.permissions}
                  defaultOpen={searchParams.get('access') === 'open'}
                />
              )}
            </div>
          </div>
          <PageTagList tags={tags} />
        </div>
        {hasNewVersion && (
          <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-4 py-2 text-sm print:hidden">
            <span>{t('pageView.newVersionBanner')}</span>
            <Button size="sm" variant="outline" onClick={handleReload}>
              {t('pageView.reloadButton')}
            </Button>
          </div>
        )}
        {hasTableOfContents && (
          <>
            <div className="xl:hidden print:hidden">
              <TableOfContentsCollapsible headings={headings} activeId={activeHeadingId} />
            </div>
            <TableOfContentsPrint headings={headings} />
          </>
        )}
        <div ref={contentRef}>
          <MarkdownRenderer content={page.content} mode="full" brokenLinks={page.brokenLinks} />
        </div>
        <div className="space-y-6 print:hidden">
          <PageBacklinks key={`backlinks-${page.id}`} pageId={page.id} />
          {page.commentsEnabled && <CommentThread pageId={page.id} />}
          <ContributorsList pageId={page.id} />
        </div>
      </article>
      {hasTableOfContents && (
        <aside className="hidden w-[220px] shrink-0 border-l border-border xl:block print:hidden">
          <TableOfContentsSidebar headings={headings} activeId={activeHeadingId} />
        </aside>
      )}
    </div>
  )
}
