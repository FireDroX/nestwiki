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
import type { GroupSummary } from '#api/groups'

interface DeleteGroupDialogProps {
  group: GroupSummary
  pending: boolean
  onConfirm: () => void
}

export function DeleteGroupDialog({ group, pending, onConfirm }: DeleteGroupDialogProps) {
  const { t } = useTranslation()
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" disabled={pending}>
          <Trash2 />
          <span className="sr-only">{t('admin.groups.deleteSr', { name: group.name })}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('admin.groups.deleteConfirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('admin.groups.deleteConfirmDescription', { name: group.name, memberCount: group.memberCount, ruleCount: group.ruleCount })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
