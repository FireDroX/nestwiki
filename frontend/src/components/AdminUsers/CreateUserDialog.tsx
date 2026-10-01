import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Controller, useForm } from 'react-hook-form'
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
import { Field, FieldError, FieldLabel } from '#components/ui/field'
import { Input } from '#components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#components/ui/select'
import { GroupsPicker } from '#components/AdminUsers/GroupsPicker'
import { TemporaryPasswordDialog } from '#components/AdminUsers/TemporaryPasswordDialog'
import { FormError } from '#components/FormError'
import { createUser, type AdminUser } from '#api/users'
import { UserRole } from '#api/auth'
import { extractErrorMessage } from '#lib/api-errors'
import { createAdminCreateUserSchema, type AdminCreateUserFormValues } from '#schemas/admin-user.schema'

interface CreateUserDialogProps {
  onCreated: (user: AdminUser) => void
}

export function CreateUserDialog({ onCreated }: CreateUserDialogProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)
  const schema = useMemo(() => createAdminCreateUserSchema(t), [t])

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<AdminCreateUserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', displayName: '', role: UserRole.Member, password: '' },
  })

  function closeDialog() {
    setOpen(false)
    setGroupIds([])
    setSubmitError(null)
    reset()
  }

  async function onSubmit(data: AdminCreateUserFormValues) {
    setSubmitError(null)
    try {
      const result = await createUser({
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        groupIds: groupIds.length > 0 ? groupIds : undefined,
        password: data.password || undefined,
      })
      onCreated(result.user)
      closeDialog()
      toast.success(t('admin.users.created'))
      if (result.temporaryPassword) {
        setTemporaryPassword(result.temporaryPassword)
      }
    } catch (error) {
      setSubmitError(extractErrorMessage(error, t('admin.users.createFailed')))
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : closeDialog())}>
        <DialogTrigger asChild>
          <Button type="button" size="sm">
            <Plus /> {t('admin.users.createButton')}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{t('admin.users.createTitle')}</DialogTitle>
              <DialogDescription>{t('admin.users.createDescription')}</DialogDescription>
            </DialogHeader>

            <Controller
              control={control}
              name="email"
              render={({ field, fieldState }) => (
                <Field data-invalid={!!fieldState.error}>
                  <FieldLabel htmlFor="new-user-email">{t('admin.users.emailLabel')}</FieldLabel>
                  <Input {...field} id="new-user-email" type="email" disabled={isSubmitting} />
                  {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                </Field>
              )}
            />

            <Controller
              control={control}
              name="displayName"
              render={({ field, fieldState }) => (
                <Field data-invalid={!!fieldState.error}>
                  <FieldLabel htmlFor="new-user-display-name">{t('admin.users.nameLabel')}</FieldLabel>
                  <Input {...field} id="new-user-display-name" disabled={isSubmitting} />
                  {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                </Field>
              )}
            />

            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="new-user-role">{t('admin.users.columnRole')}</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                    <SelectTrigger id="new-user-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UserRole.Member}>{t('admin.users.roleMember')}</SelectItem>
                      <SelectItem value={UserRole.Admin}>{t('admin.users.roleAdmin')}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            <Field>
              <FieldLabel>{t('admin.users.groupsLabel')}</FieldLabel>
              <GroupsPicker selectedGroupIds={groupIds} onChange={setGroupIds} disabled={isSubmitting} />
            </Field>

            <Controller
              control={control}
              name="password"
              render={({ field, fieldState }) => (
                <Field data-invalid={!!fieldState.error}>
                  <FieldLabel htmlFor="new-user-password">{t('admin.users.passwordLabel')}</FieldLabel>
                  <Input {...field} id="new-user-password" type="password" disabled={isSubmitting} />
                  <p className="text-xs text-muted-foreground">{t('admin.users.passwordHint')}</p>
                  {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                </Field>
              )}
            />

            <FormError message={submitError} />

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {t('common.cancel')}
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {t('admin.users.createSubmit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <TemporaryPasswordDialog password={temporaryPassword} onClose={() => setTemporaryPassword(null)} />
    </>
  )
}
