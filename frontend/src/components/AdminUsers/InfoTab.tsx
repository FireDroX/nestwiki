import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Button } from '#components/ui/button'
import { Field, FieldError, FieldLabel } from '#components/ui/field'
import { Input } from '#components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#components/ui/select'
import { FormError } from '#components/FormError'
import { ConfirmActionButton } from '#components/AdminUsers/ConfirmActionButton'
import { TemporaryPasswordDialog } from '#components/AdminUsers/TemporaryPasswordDialog'
import {
  deleteUser,
  resetUserPassword,
  setUserStatus,
  unlockUser,
  updateUser,
  type AdminUserDetail,
} from '#api/users'
import { UserRole } from '#api/auth'
import { useAuth } from '#hooks/useAuth'
import { extractErrorMessage } from '#lib/api-errors'
import { createAdminUpdateUserSchema, type AdminUpdateUserFormValues } from '#schemas/admin-user.schema'
import { intlLocale } from '#utils/relative-time'

function isLocked(user: AdminUserDetail): boolean {
  return !!user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()
}

interface InfoTabProps {
  user: AdminUserDetail
  onUpdated: (user: AdminUserDetail) => void
}

export function InfoTab({ user, onUpdated }: InfoTabProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const isSelf = user.id === currentUser?.id
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)
  const schema = useMemo(() => createAdminUpdateUserSchema(t), [t])
  const locked = isLocked(user)

  const {
    control,
    handleSubmit,
    formState: { isSubmitting, isDirty },
  } = useForm<AdminUpdateUserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: user.displayName, email: user.email, role: user.role },
  })

  async function onSubmit(data: AdminUpdateUserFormValues) {
    setSubmitError(null)
    try {
      const updated = await updateUser(user.id, data)
      onUpdated({ ...user, ...updated })
      toast.success(t('admin.users.updated'))
    } catch (error) {
      setSubmitError(extractErrorMessage(error, t('admin.users.updateFailed')))
    }
  }

  async function handleToggleStatus() {
    try {
      const updated = await setUserStatus(user.id, user.isActive === false)
      onUpdated({ ...user, ...updated })
      toast.success(user.isActive === false ? t('admin.users.reactivated') : t('admin.users.deactivated'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('admin.users.statusChangeFailed')))
    }
  }

  async function handleResetPassword() {
    try {
      const password = await resetUserPassword(user.id)
      setTemporaryPassword(password)
      toast.success(t('admin.users.passwordReset'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('admin.users.passwordResetFailed')))
    }
  }

  async function handleUnlock() {
    try {
      const updated = await unlockUser(user.id)
      onUpdated({ ...user, ...updated })
      toast.success(t('admin.users.unlocked'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('admin.users.unlockFailed')))
    }
  }

  async function handleDelete() {
    try {
      await deleteUser(user.id)
      toast.success(t('admin.users.userDeleted'))
      navigate('/admin/users')
    } catch (error) {
      toast.error(extractErrorMessage(error, t('admin.users.userDeleteFailed')))
    }
  }

  return (
    <div className="flex max-w-sm flex-col gap-6">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Controller
          control={control}
          name="displayName"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="user-display-name">{t('admin.users.nameLabel')}</FieldLabel>
              <Input {...field} id="user-display-name" disabled={isSubmitting} />
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="user-email">{t('admin.users.emailLabel')}</FieldLabel>
              <Input {...field} id="user-email" type="email" disabled={isSubmitting} />
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />

        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="user-role">{t('admin.users.columnRole')}</FieldLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isSubmitting || isSelf}
              >
                <SelectTrigger id="user-role" title={isSelf ? t('admin.users.selfRoleTooltip') : undefined}>
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

        <FormError message={submitError} />

        <Button type="submit" disabled={isSubmitting || !isDirty} className="w-fit">
          {t('common.save')}
        </Button>
      </form>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t('admin.users.lastLogin')}</dt>
        <dd>
          {user.lastLoginAt
            ? new Date(user.lastLoginAt).toLocaleString(intlLocale())
            : t('admin.users.lastLoginNever')}
        </dd>
        <dt className="text-muted-foreground">{t('admin.users.failedLoginAttempts')}</dt>
        <dd>{user.failedLoginAttempts}</dd>
      </dl>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <ConfirmActionButton
          label={user.isActive === false ? t('admin.users.reactivate') : t('admin.users.deactivate')}
          confirmTitle={
            user.isActive === false ? t('admin.users.reactivateConfirmTitle') : t('admin.users.deactivateConfirmTitle')
          }
          confirmDescription={
            user.isActive === false
              ? t('admin.users.reactivateConfirmDescription', { name: user.displayName })
              : t('admin.users.deactivateConfirmDescription', { name: user.displayName })
          }
          disabled={isSelf}
          disabledReason={t('admin.users.selfDeactivateTooltip')}
          onConfirm={handleToggleStatus}
        />

        <ConfirmActionButton
          label={t('admin.users.resetPassword')}
          confirmTitle={t('admin.users.resetPasswordConfirmTitle')}
          confirmDescription={t('admin.users.resetPasswordConfirmDescription', { name: user.displayName })}
          onConfirm={handleResetPassword}
        />

        <ConfirmActionButton
          label={t('admin.users.unlock')}
          confirmTitle={t('admin.users.unlockConfirmTitle')}
          confirmDescription={t('admin.users.unlockConfirmDescription', { name: user.displayName })}
          disabled={!locked}
          disabledReason={t('admin.users.notLockedTooltip')}
          onConfirm={handleUnlock}
        />

        <ConfirmActionButton
          label={t('common.delete')}
          confirmTitle={t('admin.users.deleteConfirmTitle')}
          confirmDescription={t('admin.users.deleteConfirmDescription', { name: user.displayName, email: user.email })}
          variant="destructive"
          disabled={isSelf}
          disabledReason={t('admin.users.selfDeleteTooltip')}
          onConfirm={handleDelete}
        />
      </div>

      <TemporaryPasswordDialog password={temporaryPassword} onClose={() => setTemporaryPassword(null)} />
    </div>
  )
}
