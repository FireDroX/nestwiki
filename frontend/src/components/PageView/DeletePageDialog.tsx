import { Trash2 } from 'lucide-react'
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
import { Button } from '#components/ui/button'

interface DeletePageDialogProps {
  title: string
  descendantCount: number
  pending: boolean
  onConfirm: () => void
}

export function DeletePageDialog({ title, descendantCount, pending, onConfirm }: DeletePageDialogProps) {
  const { t } = useTranslation()
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          <Trash2 /> {t('pageView.delete')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('pageView.deleteConfirmTitle', { title })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('pageView.deleteConfirmDescription')}
            {descendantCount > 0 && ` ${t('pageView.deleteConfirmDescendants', { count: descendantCount })}`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {t('pageView.deleteConfirmAction')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
