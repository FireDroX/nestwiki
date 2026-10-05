import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { AdminNav } from '#components/AdminNav'
import { Field, FieldLabel } from '#components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#components/ui/select'
import { updateSetting } from '#api/settings'
import { extractErrorMessage } from '#lib/api-errors'
import i18n from '#lib/i18n'
import { PAGE_PADDING } from '#utils/page-layout'

export function AdminSettings() {
  const { t } = useTranslation()
  const [locale, setLocale] = useState(i18n.language)
  const [pending, setPending] = useState(false)
  const locales = [
    { value: 'fr', label: t('admin.settings.localeFr') },
    { value: 'en', label: t('admin.settings.localeEn') },
  ]

  async function handleLocaleChange(value: string) {
    const previous = locale
    setLocale(value)
    setPending(true)
    try {
      await updateSetting('locale', value)
      await i18n.changeLanguage(value)
      toast.success(i18n.t('admin.settings.localeUpdated'))
    } catch (error) {
      setLocale(previous)
      toast.error(extractErrorMessage(error, i18n.t('admin.settings.localeUpdateFailed')))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={PAGE_PADDING}>
      <AdminNav />
      <Field className="mt-5 max-w-sm">
        <FieldLabel>{t('admin.settings.localeLabel')}</FieldLabel>
        <Select value={locale} onValueChange={handleLocaleChange} disabled={pending}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {locales.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">{t('admin.settings.localeHelp')}</p>
      </Field>
    </div>
  )
}
