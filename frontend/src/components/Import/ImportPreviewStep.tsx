import { Globe, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '#components/ui/button'
import { Checkbox } from '#components/ui/checkbox'
import { Field, FieldLabel } from '#components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#components/ui/select'
import { FormError } from '#components/FormError'
import {
  IMPORT_CONFLICT_MODES,
  type ImportConflictMode,
  type ImportPlan,
  type ImportPlanPage,
} from '#api/imports'
import type { PageVisibility } from '#api/pages'
import { formatFileSize } from '#utils/file-size'
import { ImportPlanTree } from './ImportPlanTree'
import { ImportWarnings } from './ImportWarnings'

interface ImportPreviewStepProps {
  plan: ImportPlan
  visibility: PageVisibility
  createMissingTags: boolean
  pending: boolean
  error: string | null
  onConflictChange: (conflict: ImportConflictMode) => void
  onVisibilityChange: (visibility: PageVisibility) => void
  onCreateMissingTagsChange: (createMissingTags: boolean) => void
  onBack: () => void
  onImport: () => void
}

function countWrittenPages(pages: ImportPlanPage[]): number {
  return pages.reduce(
    (total, page) => total + (page.action === 'skip' ? 0 : 1) + countWrittenPages(page.children),
    0,
  )
}

export function ImportPreviewStep({
  plan,
  visibility,
  createMissingTags,
  pending,
  error,
  onConflictChange,
  onVisibilityChange,
  onCreateMissingTagsChange,
  onBack,
  onImport,
}: ImportPreviewStepProps) {
  const { t, i18n } = useTranslation()
  const writtenCount = countWrittenPages(plan.pages)
  const hasConflicts = plan.conflictCount > 0 || plan.conflictMode !== 'skip'
  const canCreateMissingTags = plan.permissions.canCreateTags && plan.tags.missing.length > 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-sm">
        <p className="font-medium">
          {t(`import.preview.formats.${plan.format}`)} · {t('import.preview.pages', { count: plan.pageCount })}
          {plan.media.count > 0 &&
            ` · ${t('import.preview.media', {
              count: plan.media.count,
              size: formatFileSize(plan.media.totalSize, i18n.language),
            })}`}
        </p>
        <p className="break-words text-muted-foreground">
          {t('import.preview.destination', { path: plan.destination.path ?? t('import.file.root') })}
        </p>
        {plan.conflictCount > 0 && (
          <p className="text-amber-700 dark:text-amber-400">
            {t('import.preview.conflicts', { count: plan.conflictCount })}
          </p>
        )}
      </div>

      <section className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold">{t('import.preview.optionsTitle')}</h2>
        {hasConflicts && (
          <Field>
            <FieldLabel htmlFor="import-conflict">{t('import.preview.conflictLabel')}</FieldLabel>
            <Select
              value={plan.conflictMode}
              disabled={pending}
              onValueChange={(value) => onConflictChange(value as ImportConflictMode)}
            >
              <SelectTrigger id="import-conflict" className="w-full sm:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMPORT_CONFLICT_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {t(`import.preview.conflictModes.${mode}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field>
          <FieldLabel>{t('import.preview.visibilityLabel')}</FieldLabel>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={visibility === 'private' ? 'default' : 'outline'}
              aria-pressed={visibility === 'private'}
              disabled={pending}
              onClick={() => onVisibilityChange('private')}
            >
              <Lock /> {t('import.preview.private')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={visibility === 'public' ? 'default' : 'outline'}
              aria-pressed={visibility === 'public'}
              disabled={pending}
              onClick={() => onVisibilityChange('public')}
            >
              <Globe /> {t('import.preview.public')}
            </Button>
          </div>
        </Field>
        {canCreateMissingTags && (
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={createMissingTags}
              disabled={pending}
              onCheckedChange={(checked) => onCreateMissingTagsChange(checked === true)}
            />
            <span className="min-w-0 break-words">
              {t('import.preview.createMissingTags', {
                count: plan.tags.missing.length,
                tags: plan.tags.missing.join(', '),
              })}
            </span>
          </label>
        )}
      </section>

      <section className="flex min-w-0 flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('import.preview.pagesTitle')}</h2>
        <div className="max-h-96 min-w-0 overflow-y-auto rounded-lg border border-border p-2">
          <ImportPlanTree pages={plan.pages} />
        </div>
      </section>

      <ImportWarnings
        warnings={{
          ...plan.warnings,
          missingTags: createMissingTags && canCreateMissingTags ? [] : plan.tags.missing,
        }}
      />

      {writtenCount === 0 && <p className="text-sm text-muted-foreground">{t('import.preview.nothingToImport')}</p>}
      <FormError message={error} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" disabled={pending} onClick={onBack}>
          {t('import.preview.back')}
        </Button>
        <Button type="button" disabled={pending || writtenCount === 0} onClick={onImport}>
          {t('import.preview.importButton', { count: writtenCount })}
        </Button>
      </div>
    </div>
  )
}
