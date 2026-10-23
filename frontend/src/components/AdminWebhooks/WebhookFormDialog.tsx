import { useMemo, useRef, useState, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Controller, useForm, useWatch } from 'react-hook-form'
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
import { Checkbox } from '#components/ui/checkbox'
import { Field, FieldError, FieldLabel } from '#components/ui/field'
import { Input } from '#components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#components/ui/select'
import { FormError } from '#components/FormError'
import { WebhookEventsPicker } from '#components/AdminWebhooks/WebhookEventsPicker'
import { WebhookScopeTree } from '#components/AdminWebhooks/WebhookScopeTree'
import { createWebhook, updateWebhook, WEBHOOK_FORMATS, type Webhook, type WebhookInput } from '#api/webhooks'
import { extractErrorMessage } from '#lib/api-errors'
import { createWebhookSchema, type WebhookFormValues } from '#schemas/webhook.schema'
import { detectWebhookFormat } from '#utils/webhook-url'

interface WebhookFormDialogProps {
  webhook?: Webhook
  trigger: ReactNode
  onSaved: (webhook: Webhook) => void
}

function initialValues(webhook: Webhook | undefined): WebhookFormValues {
  return {
    name: webhook?.name ?? '',
    url: webhook?.url ?? '',
    format: webhook?.format ?? 'json',
    events: webhook?.events ?? [],
    includePrivatePages: webhook?.includePrivatePages ?? false,
    scopePageId: webhook?.scopePageId ?? null,
    enabled: webhook?.enabled ?? true,
  }
}

function changedValues(values: WebhookFormValues, webhook: Webhook): Partial<WebhookInput> {
  const saved = initialValues(webhook)
  const keys = Object.keys(values) as (keyof WebhookFormValues)[]
  return Object.fromEntries(
    keys
      .filter((key) => JSON.stringify(values[key]) !== JSON.stringify(saved[key]))
      .map((key) => [key, values[key]]),
  )
}

export function WebhookFormDialog({ webhook, trigger, onSaved }: WebhookFormDialogProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const formatChosenByUser = useRef(false)
  const schema = useMemo(() => createWebhookSchema(t), [t])
  const isEdit = webhook !== undefined

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting },
  } = useForm<WebhookFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues(webhook),
  })
  const url = useWatch({ control, name: 'url' })
  const format = useWatch({ control, name: 'format' })
  const includePrivatePages = useWatch({ control, name: 'includePrivatePages' })
  const detectedFormat = detectWebhookFormat(url)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      formatChosenByUser.current = isEdit
      setSubmitError(null)
      reset(initialValues(webhook))
    }
  }

  function handleUrlChange(nextUrl: string, onChange: (value: string) => void) {
    onChange(nextUrl)
    if (!formatChosenByUser.current) {
      setValue('format', detectWebhookFormat(nextUrl) ?? 'json')
    }
  }

  async function onSubmit(values: WebhookFormValues) {
    setSubmitError(null)
    try {
      const saved = isEdit
        ? await updateWebhook(webhook.id, changedValues(values, webhook))
        : await createWebhook(values)
      onSaved(saved)
      setOpen(false)
      toast.success(t(isEdit ? 'admin.webhooks.updated' : 'admin.webhooks.created'))
    } catch (error) {
      setSubmitError(extractErrorMessage(error, t(isEdit ? 'admin.webhooks.updateFailed' : 'admin.webhooks.createFailed')))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-w-0 flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t(isEdit ? 'admin.webhooks.form.editTitle' : 'admin.webhooks.form.createTitle')}</DialogTitle>
            <DialogDescription>{t('admin.webhooks.form.description')}</DialogDescription>
          </DialogHeader>

          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <Field data-invalid={!!fieldState.error}>
                <FieldLabel htmlFor="webhook-name">{t('admin.webhooks.form.nameLabel')}</FieldLabel>
                <Input {...field} id="webhook-name" disabled={isSubmitting} />
                {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
              </Field>
            )}
          />

          <Controller
            control={control}
            name="url"
            render={({ field, fieldState }) => (
              <Field data-invalid={!!fieldState.error}>
                <FieldLabel htmlFor="webhook-url">{t('admin.webhooks.form.urlLabel')}</FieldLabel>
                <Input
                  {...field}
                  id="webhook-url"
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  disabled={isSubmitting}
                  onChange={(event) => handleUrlChange(event.target.value, field.onChange)}
                />
                {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
              </Field>
            )}
          />

          <Controller
            control={control}
            name="format"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="webhook-format">{t('admin.webhooks.form.formatLabel')}</FieldLabel>
                <Select
                  value={field.value}
                  onValueChange={(next) => {
                    formatChosenByUser.current = true
                    field.onChange(next)
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="webhook-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEBHOOK_FORMATS.map((format) => (
                      <SelectItem key={format} value={format}>
                        {t(`admin.webhooks.formats.${format}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {detectedFormat && (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      detectedFormat === format
                        ? 'admin.webhooks.form.formatDetected'
                        : 'admin.webhooks.form.formatSuggested',
                      { format: t(`admin.webhooks.formats.${detectedFormat}`) },
                    )}
                  </p>
                )}
              </Field>
            )}
          />

          <Controller
            control={control}
            name="events"
            render={({ field, fieldState }) => (
              <Field data-invalid={!!fieldState.error}>
                <FieldLabel>{t('admin.webhooks.form.eventsLabel')}</FieldLabel>
                <WebhookEventsPicker value={field.value} onChange={field.onChange} disabled={isSubmitting} />
                {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
              </Field>
            )}
          />

          <Controller
            control={control}
            name="scopePageId"
            render={({ field }) => (
              <Field>
                <FieldLabel>{t('admin.webhooks.form.scopeLabel')}</FieldLabel>
                <p className="text-xs text-muted-foreground">{t('admin.webhooks.form.scopeHint')}</p>
                <WebhookScopeTree value={field.value} onChange={field.onChange} disabled={isSubmitting} />
              </Field>
            )}
          />

          <Controller
            control={control}
            name="includePrivatePages"
            render={({ field }) => (
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={field.value}
                    disabled={isSubmitting}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                  {t('admin.webhooks.form.includePrivatePagesLabel')}
                </label>
                {includePrivatePages && (
                  <p
                    role="alert"
                    className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive"
                  >
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    {t('admin.webhooks.form.includePrivatePagesWarning')}
                  </p>
                )}
              </div>
            )}
          />

          <Controller
            control={control}
            name="enabled"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={field.value}
                  disabled={isSubmitting}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
                {t('admin.webhooks.form.enabledLabel')}
              </label>
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
              {t(isEdit ? 'common.save' : 'admin.webhooks.form.createSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
