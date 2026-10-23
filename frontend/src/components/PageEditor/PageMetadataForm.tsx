import { useState } from 'react'
import { Controller, type Control, type UseFormSetValue, type UseFormWatch } from 'react-hook-form'
import { FolderTree, Lock, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '#components/ui/button'
import { Checkbox } from '#components/ui/checkbox'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#components/ui/command'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '#components/ui/field'
import { Input } from '#components/ui/input'
import { usePageTree } from '#hooks/usePageTree'
import { collectSubtreeIds, findPathToNode, flattenTree } from '#utils/page-tree'
import { slugify } from '#utils/slug'
import type { PageVisibility } from '#api/pages'
import type { PageMetadataFormValues } from '#schemas/page-metadata.schema'

interface PageMetadataFormProps {
  mode: 'create' | 'edit'
  control: Control<PageMetadataFormValues>
  setValue: UseFormSetValue<PageMetadataFormValues>
  watch: UseFormWatch<PageMetadataFormValues>
  excludePageId?: string | null
  commentsEnabled?: boolean
  onParentChange?: (newParentId: string | null) => void
  linkingPageCount?: number
  updateLinks?: boolean
  onUpdateLinksChange?: (updateLinks: boolean) => void
  onVisibilityChange?: (visibility: PageVisibility) => void
  onCommentsEnabledChange?: (commentsEnabled: boolean) => void
}

export function PageMetadataForm({
  mode,
  control,
  setValue,
  watch,
  excludePageId,
  commentsEnabled,
  onParentChange,
  linkingPageCount = 0,
  updateLinks,
  onUpdateLinksChange,
  onVisibilityChange,
  onCommentsEnabledChange,
}: PageMetadataFormProps) {
  const { t } = useTranslation()
  const [slugTouched, setSlugTouched] = useState(false)
  const [parentPickerOpen, setParentPickerOpen] = useState(false)
  const { tree } = usePageTree()

  const excludedIds = excludePageId ? collectSubtreeIds(tree, excludePageId) : []
  const hasChildren = excludedIds.length > 1

  function selectVisibility(next: PageVisibility) {
    setValue('visibility', next, { shouldValidate: true })
    if (mode === 'edit') {
      onVisibilityChange?.(next)
    }
  }
  const parentOptions = flattenTree(tree).filter((node) => !excludedIds.includes(node.id))
  const parentId = watch('parentId')
  const parentPath = parentId ? findPathToNode(tree, (node) => node.id === parentId) : null
  const parentLabel = parentPath ? parentPath.map((node) => node.title).join(' / ') : t('pageMetadataForm.none')
  const pathPrefix = parentPath ? `/${parentPath.map((node) => node.slug).join('/')}/` : '/'

  function selectParent(nextParentId: string | null) {
    setValue('parentId', nextParentId, { shouldValidate: true })
    setParentPickerOpen(false)
    if (mode === 'edit') {
      onParentChange?.(nextParentId)
    }
  }

  return (
    <FieldGroup>
      <Controller
        control={control}
        name="title"
        render={({ field, fieldState }) => (
          <Field data-invalid={!!fieldState.error}>
            <FieldLabel htmlFor="page-title">{t('pageMetadataForm.titleLabel')}</FieldLabel>
            <Input
              {...field}
              id="page-title"
              onChange={(event) => {
                field.onChange(event)
                if (mode === 'create' && !slugTouched) {
                  setValue('slug', slugify(event.target.value), { shouldValidate: true })
                }
              }}
            />
            {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
          </Field>
        )}
      />
      <Controller
        control={control}
        name="slug"
        render={({ field, fieldState }) => (
          <Field data-invalid={!!fieldState.error}>
            <FieldLabel htmlFor="page-slug">{t('pageMetadataForm.pathLabel')}</FieldLabel>
            {mode === 'create' ? (
              <div className="flex h-8 items-center gap-1 rounded-lg border border-input bg-transparent px-2.5 has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50">
                <span className="shrink-0 text-sm text-muted-foreground">{pathPrefix}</span>
                <input
                  {...field}
                  id="page-slug"
                  className="w-full min-w-0 bg-transparent text-sm outline-none"
                  onChange={(event) => {
                    setSlugTouched(true)
                    field.onChange(event)
                  }}
                />
              </div>
            ) : (
              <p dir="rtl" className="truncate text-left text-sm text-muted-foreground">
                {pathPrefix}
                {field.value}
              </p>
            )}
            {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            {mode === 'edit' && <FieldDescription>{t('pageMetadataForm.pathImmutable')}</FieldDescription>}
          </Field>
        )}
      />
      <Field>
        <FieldLabel>{t('pageMetadataForm.parentLabel')}</FieldLabel>
        <Button
          type="button"
          variant="outline"
          className="justify-start overflow-hidden"
          onClick={() => setParentPickerOpen(true)}
        >
          <FolderTree />
          <span dir="rtl" className="min-w-0 flex-1 truncate text-left">
            {parentLabel}
          </span>
        </Button>
        {mode === 'edit' && linkingPageCount > 0 && (
          <>
            <FieldDescription>{t('pageMetadataForm.linkingPages', { count: linkingPageCount })}</FieldDescription>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={updateLinks}
                onCheckedChange={(checked) => onUpdateLinksChange?.(checked === true)}
              />
              <span>{t('pageMetadataForm.updateLinks')}</span>
            </label>
          </>
        )}
      </Field>
      <Controller
        control={control}
        name="visibility"
        render={({ field }) => (
          <Field>
            <FieldLabel>{t('pageMetadataForm.visibilityLabel')}</FieldLabel>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={field.value === 'private' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => selectVisibility('private')}
              >
                <Lock /> {t('pageMetadataForm.private')}
              </Button>
              <Button
                type="button"
                variant={field.value === 'public' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => selectVisibility('public')}
              >
                <Globe /> {t('pageMetadataForm.public')}
              </Button>
            </div>
            {mode === 'edit' && hasChildren && (
              <FieldDescription>{t('pageMetadataForm.visibilityCascadeNotice')}</FieldDescription>
            )}
          </Field>
        )}
      />
      {mode === 'edit' && commentsEnabled !== undefined && (
        <Field>
          <FieldLabel>{t('pageMetadataForm.commentsLabel')}</FieldLabel>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={commentsEnabled}
              onCheckedChange={(checked) => onCommentsEnabledChange?.(checked === true)}
            />
            <span>{t('pageMetadataForm.commentsEnabled')}</span>
          </label>
        </Field>
      )}
      <CommandDialog
        open={parentPickerOpen}
        onOpenChange={setParentPickerOpen}
        title={t('pageMetadataForm.choosePage')}
        className="left-4 right-4 w-auto max-w-none translate-x-0 sm:left-1/2 sm:right-auto sm:w-fit sm:max-w-[calc(100%-2rem)] sm:-translate-x-1/2"
      >
        <Command>
          <CommandInput placeholder={t('pageMetadataForm.searchPage')} />
          <CommandList>
            <CommandEmpty>{t('pageMetadataForm.noPageFound')}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={t('pageMetadataForm.none')}
                onSelect={() => selectParent(null)}
                className="whitespace-nowrap"
              >
                {t('pageMetadataForm.none')}
              </CommandItem>
              {parentOptions.map((node) => (
                <CommandItem
                  key={node.id}
                  value={node.path}
                  onSelect={() => selectParent(node.id)}
                  className="whitespace-nowrap"
                >
                  {node.path}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </FieldGroup>
  )
}
