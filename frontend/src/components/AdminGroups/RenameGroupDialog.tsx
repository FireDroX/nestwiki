import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#components/ui/dialog'
import { Button } from '#components/ui/button'
import { Field, FieldLabel } from '#components/ui/field'
import { Input } from '#components/ui/input'
import { Textarea } from '#components/ui/textarea'
import { updateGroup } from '#api/groups'
import { extractErrorMessage } from '#lib/api-errors'

interface RenameGroupDialogProps {
  groupId: string
  currentName: string
  currentDescription: string | null
  onRenamed: (name: string, description: string | null) => void
}

export function RenameGroupDialog({ groupId, currentName, currentDescription, onRenamed }: RenameGroupDialogProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(currentName)
  const [description, setDescription] = useState(currentDescription ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(currentName)
      setDescription(currentDescription ?? '')
    }
  }, [open, currentName, currentDescription])

  async function handleSave() {
    const trimmedName = name.trim()
    if (!trimmedName) return
    setSaving(true)
    try {
      const updated = await updateGroup(groupId, { name: trimmedName, description: description.trim() })
      onRenamed(updated.name, updated.description)
      setOpen(false)
      toast.success(t('admin.groups.renamed'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('admin.groups.renameFailed')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm">
          <Pencil />
          <span className="sr-only">{t('admin.groups.renameSr', { name: currentName })}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.groups.renameTitle')}</DialogTitle>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="rename-group-name">{t('admin.groups.nameLabel')}</FieldLabel>
          <Input id="rename-group-name" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>

        <Field>
          <FieldLabel htmlFor="rename-group-description">{t('admin.groups.descriptionLabel')}</FieldLabel>
          <Textarea
            id="rename-group-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t('common.cancel')}
            </Button>
          </DialogClose>
          <Button type="button" disabled={!name.trim() || saving} onClick={handleSave}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
