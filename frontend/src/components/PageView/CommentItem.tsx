import { useState } from 'react'
import { Pencil, Reply, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
import { Avatar, AvatarFallback, AvatarImage } from '#components/ui/avatar'
import { Button } from '#components/ui/button'
import { MarkdownRenderer } from '#components/MarkdownRenderer'
import { CommentForm } from '#components/PageView/CommentForm'
import type { Comment } from '#api/comments'
import { useAuth } from '#hooks/useAuth'
import { usePermissions } from '#hooks/usePermissions'
import { toInitials } from '#utils/initials'
import { formatRelativeTime } from '#utils/relative-time'

interface CommentItemProps {
  comment: Comment
  replyCount?: number
  onReply?: (content: string) => Promise<void>
  onEdit: (content: string) => Promise<void>
  onDelete: () => Promise<void>
}

export function CommentItem({ comment, replyCount = 0, onReply, onEdit, onDelete }: CommentItemProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { hasGlobal } = usePermissions()
  const [isEditing, setIsEditing] = useState(false)
  const [isReplying, setIsReplying] = useState(false)

  const isAuthor = user?.id === comment.authorId
  const isModerator = hasGlobal('comment.moderate')
  const canDelete = isAuthor || isModerator
  const isDeleted = !!comment.deletedAt

  if (isDeleted) {
    return (
      <div className="flex gap-3 py-3">
        <Avatar className="size-8 shrink-0">
          <AvatarFallback>?</AvatarFallback>
        </Avatar>
        <p className="text-sm text-muted-foreground italic">{t('comments.deletedPlaceholder')}</p>
      </div>
    )
  }

  if (isEditing) {
    return (
      <div className="py-3">
        <CommentForm
          initialValue={comment.content}
          submitLabel={t('comments.save')}
          autoFocus
          onCancel={() => setIsEditing(false)}
          onSubmit={async (content) => {
            await onEdit(content)
            setIsEditing(false)
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex gap-3 py-3">
      <Avatar className="size-8 shrink-0">
        <AvatarImage src={comment.authorAvatarUrl ?? undefined} alt={comment.authorDisplayName ?? ''} />
        <AvatarFallback>{toInitials(comment.authorDisplayName ?? '?')}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">{comment.authorDisplayName ?? t('comments.unknownAuthor')}</span>
          <span className="text-xs text-muted-foreground">{formatRelativeTime(comment.createdAt)}</span>
          {comment.editedAt && (
            <span className="text-xs text-muted-foreground">{t('comments.edited')}</span>
          )}
        </div>
        <MarkdownRenderer content={comment.content} />
        <div className="flex gap-1">
          {onReply && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsReplying((value) => !value)}>
              <Reply /> {t('comments.reply')}
            </Button>
          )}
          {isAuthor && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil /> {t('comments.edit')}
            </Button>
          )}
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" size="sm">
                  <Trash2 /> {t('common.delete')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('comments.deleteConfirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {isAuthor
                      ? t('comments.deleteConfirmAuthorDescription')
                      : replyCount > 0
                        ? t('comments.deleteConfirmModeratorWithRepliesDescription', { count: replyCount })
                        : t('comments.deleteConfirmModeratorDescription')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => void onDelete()}>
                    {t('common.delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        {isReplying && onReply && (
          <div className="pt-2">
            <CommentForm
              submitLabel={t('comments.reply')}
              autoFocus
              onCancel={() => setIsReplying(false)}
              onSubmit={async (content) => {
                await onReply(content)
                setIsReplying(false)
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
