import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#components/ui/dialog'
import { Button } from '#components/ui/button'
import { Field, FieldLabel } from '#components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#components/ui/select'
import { getGroupDetail, listGroups, setGroupMembers, type GroupSummary } from '#api/groups'
import { extractErrorMessage } from '#lib/api-errors'

interface AddToGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userIds: string[]
  onDone: () => void
}

export function AddToGroupDialog({ open, onOpenChange, userIds, onDone }: AddToGroupDialogProps) {
  const { t } = useTranslation()
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [groupId, setGroupId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setGroupId('')
    listGroups()
      .then(setGroups)
      .catch(() => setGroups([]))
  }, [open])

  async function handleConfirm() {
    if (!groupId) return
    setSubmitting(true)
    try {
      const group = await getGroupDetail(groupId)
      const memberIds = new Set(group.members.map((member) => member.id))
      for (const userId of userIds) {
        memberIds.add(userId)
      }
      await setGroupMembers(groupId, [...memberIds])
      toast.success(t('admin.users.addedToGroup', { count: userIds.length, name: group.name }))
      onOpenChange(false)
      onDone()
    } catch (error) {
      toast.error(extractErrorMessage(error, t('admin.users.addToGroupFailed')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.users.addToGroupTitle')}</DialogTitle>
          <DialogDescription>{t('admin.users.addToGroupDescription', { count: userIds.length })}</DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="bulk-add-group">{t('admin.users.groupsLabel')}</FieldLabel>
          <Select value={groupId} onValueChange={setGroupId} disabled={submitting}>
            <SelectTrigger id="bulk-add-group">
              <SelectValue placeholder={t('admin.users.selectGroupPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t('common.cancel')}
            </Button>
          </DialogClose>
          <Button type="button" disabled={!groupId || submitting} onClick={handleConfirm}>
            {t('admin.users.addToGroupSubmit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
