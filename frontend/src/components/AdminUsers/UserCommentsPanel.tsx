import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
import { Checkbox } from '#components/ui/checkbox'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '#components/ui/sheet'
import type { AdminUser } from '#api/users'
import { useUserComments } from '#hooks/useUserComments'
import { extractErrorMessage } from '#lib/api-errors'
import { formatDateTime } from '#utils/relative-time'

interface UserCommentsPanelProps {
  user: AdminUser
}

export function UserCommentsPanel({ user }: UserCommentsPanelProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const {
    comments,
    total,
    page,
    limit,
    status,
    selectedIds,
    pending,
    toggleSelected,
    goToPage,
    purgeSelected,
    purgeAll,
  } = useUserComments(user.id, open)

  const totalPages = Math.max(1, Math.ceil(total / limit))

  async function handlePurge(action: () => Promise<number>) {
    try {
      const count = await action()
      toast.success(t('admin.users.comments.purgeSuccess', { count }))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('admin.users.comments.purgeFailed')))
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm">
          <MessageSquare />
          <span className="sr-only">{t('admin.users.comments.trigger')}</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t('admin.users.comments.title', { name: user.displayName })}</SheetTitle>
          <SheetDescription>{t('admin.users.comments.description', { count: total })}</SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-2 px-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" disabled={selectedIds.length === 0 || pending}>
                {t('admin.users.comments.purgeSelection', { count: selectedIds.length })}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('admin.users.comments.purgeSelectionConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('admin.users.comments.purgeSelectionConfirmDescription', { count: selectedIds.length })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => void handlePurge(purgeSelected)}>
                  {t('common.delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" size="sm" disabled={total === 0 || pending}>
                {t('admin.users.comments.purgeAll')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('admin.users.comments.purgeAllConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('admin.users.comments.purgeAllConfirmDescription', {
                    count: total,
                    name: user.displayName,
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => void handlePurge(purgeAll)}>
                  {t('common.delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-2">
          {status === 'loading' && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
          {status === 'error' && (
            <p className="text-sm text-destructive">{t('admin.users.comments.loadError')}</p>
          )}
          {status === 'ready' && comments.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('admin.users.comments.empty')}</p>
          )}
          {status === 'ready' &&
            comments.map((comment) => (
              <div key={comment.id} className="flex items-start gap-2 border-b pb-2">
                <Checkbox
                  checked={selectedIds.includes(comment.id)}
                  onCheckedChange={() => toggleSelected(comment.id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-muted-foreground">
                    {comment.pagePath ?? comment.pageId ?? t('admin.users.comments.hiddenPage')} ·{' '}
                    {formatDateTime(comment.createdAt)}
                  </p>
                  {comment.content === null ? (
                    <p className="truncate text-sm italic text-muted-foreground">
                      {t('admin.users.comments.hiddenContent')}
                    </p>
                  ) : (
                    <p className="truncate text-sm">
                      {comment.deletedAt ? t('comments.deletedPlaceholder') : comment.content}
                    </p>
                  )}
                </div>
              </div>
            ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              {t('common.previous')}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t('common.pageOf', { page, total: totalPages })}
            </span>
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
      </SheetContent>
    </Sheet>
  )
}
