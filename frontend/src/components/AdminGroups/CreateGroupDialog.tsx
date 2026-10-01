import { useState } from 'react'
import { Plus } from 'lucide-react'
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
  DialogTrigger,
} from '#components/ui/dialog'
import { Button } from '#components/ui/button'
import { Field, FieldLabel } from '#components/ui/field'
import { Input } from '#components/ui/input'
import { Textarea } from '#components/ui/textarea'
import { createGroup, type GroupSummary } from '#api/groups'
import { extractErrorMessage } from '#lib/api-errors'

interface CreateGroupDialogProps {
  onCreated: (group: GroupSummary) => void
}

export function CreateGroupDialog({ onCreated }: CreateGroupDialogProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  function reset() {
    setName('')
    setDescription('')
  }

  async function handleCreate() {
    const trimmedName = name.trim()
    if (!trimmedName) return
    setCreating(true)
    try {
      const group = await createGroup({ name: trimmedName, description: description.trim() || undefined })
      onCreated({ id: group.id, name: group.name, description: group.description, memberCount: 0, ruleCount: 0 })
      setOpen(false)
      reset()
      toast.success(t('admin.groups.created'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('admin.groups.createFailed')))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <Plus /> {t('admin.groups.createButton')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.groups.createTitle')}</DialogTitle>
          <DialogDescription>{t('admin.groups.createDescription')}</DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="new-group-name">{t('admin.groups.nameLabel')}</FieldLabel>
          <Input id="new-group-name" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>

        <Field>
          <FieldLabel htmlFor="new-group-description">{t('admin.groups.descriptionLabel')}</FieldLabel>
          <Textarea
            id="new-group-description"
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
          <Button type="button" disabled={!name.trim() || creating} onClick={handleCreate}>
            {t('admin.groups.createSubmit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
