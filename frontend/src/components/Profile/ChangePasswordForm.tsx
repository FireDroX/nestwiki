import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Button } from '#components/ui/button'
import { Field, FieldError, FieldLabel } from '#components/ui/field'
import { Input } from '#components/ui/input'
import { FormError } from '#components/FormError'
import { changePassword } from '#api/auth'
import { extractErrorMessage } from '#lib/api-errors'
import { createChangePasswordSchema, type ChangePasswordFormValues } from '#schemas/profile.schema'

function changePasswordErrorMessage(error: unknown, t: TFunction): string {
  if (isAxiosError(error) && error.response?.status === 401) {
    return t('profile.security.incorrectCurrentPassword')
  }
  return extractErrorMessage(error, t('profile.security.updateFailed'))
}

export function ChangePasswordForm() {
  const { t } = useTranslation()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const schema = useMemo(() => createChangePasswordSchema(t), [t])

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '' },
  })

  async function onSubmit(data: ChangePasswordFormValues) {
    setSubmitError(null)
    try {
      await changePassword(data.currentPassword, data.newPassword)
      reset()
      toast.success(t('profile.security.updateSuccess'))
    } catch (error) {
      setSubmitError(changePasswordErrorMessage(error, t))
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
      <h2 className="font-heading text-lg font-semibold">{t('profile.security.passwordTitle')}</h2>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 flex max-w-sm flex-col gap-4">
        <Controller
          control={control}
          name="currentPassword"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="current-password">{t('profile.security.currentPasswordLabel')}</FieldLabel>
              <Input {...field} id="current-password" type="password" autoComplete="current-password" disabled={isSubmitting} />
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />
        <Controller
          control={control}
          name="newPassword"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="new-password">{t('profile.security.newPasswordLabel')}</FieldLabel>
              <Input {...field} id="new-password" type="password" autoComplete="new-password" disabled={isSubmitting} />
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />
        <FormError message={submitError} />
        <Button type="submit" disabled={isSubmitting} className="self-start">
          {t('profile.security.submit')}
        </Button>
      </form>
    </div>
  )
}
