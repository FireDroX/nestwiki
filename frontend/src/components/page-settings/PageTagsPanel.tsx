import { useEffect, useState } from 'react'
import { Plus, Tag as TagIcon, Trash2, X } from 'lucide-react'
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
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#components/ui/command'
import { Button } from '#components/ui/button'
import { Field, FieldLabel } from '#components/ui/field'
import { Input } from '#components/ui/input'
import {
  createTag,
  deleteTag,
  getPageTags,
  listTags,
  tagPage,
  untagPage,
  type TagSummary,
} from '#api/tags'
import { extractErrorMessage } from '#lib/api-errors'

interface PageTagsPanelProps {
  pageId: string
  canManageTags: boolean
  canDeleteTags: boolean
}

type Status = 'loading' | 'ready' | 'error'

const DEFAULT_TAG_COLOR = '#6b7280'

export function PageTagsPanel({ pageId, canManageTags, canDeleteTags }: PageTagsPanelProps) {
  const { t } = useTranslation()
  const [allTags, setAllTags] = useState<TagSummary[]>([])
  const [pageTags, setPageTags] = useState<TagSummary[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingTagId, setPendingTagId] = useState<string | null>(null)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_COLOR)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setStatus('loading')
      try {
        const [all, current] = await Promise.all([listTags(), getPageTags(pageId)])
        if (cancelled) return
        setAllTags(all)
        setPageTags(current)
        setStatus('ready')
      } catch {
        if (!cancelled) {
          setStatus('error')
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [pageId])

  const attachableTags = allTags.filter((tag) => !pageTags.some((pageTag) => pageTag.id === tag.id))

  async function handleAttach(tagId: string) {
    setPickerOpen(false)
    setPendingTagId(tagId)
    try {
      await tagPage(pageId, tagId)
      const tag = allTags.find((item) => item.id === tagId)
      if (tag) {
        setPageTags((current) => [...current, tag])
      }
      toast.success(t('tags.attached'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('tags.attachFailed')))
    } finally {
      setPendingTagId(null)
    }
  }

  async function handleDetach(tagId: string) {
    setPendingTagId(tagId)
    try {
      await untagPage(pageId, tagId)
      setPageTags((current) => current.filter((tag) => tag.id !== tagId))
      toast.success(t('tags.detached'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('tags.detachFailed')))
    } finally {
      setPendingTagId(null)
    }
  }

  async function handleDelete(tag: TagSummary) {
    if (!window.confirm(t('tags.deleteConfirm', { name: tag.name }))) {
      return
    }
    setPendingTagId(tag.id)
    try {
      await deleteTag(tag.id)
      setAllTags((current) => current.filter((item) => item.id !== tag.id))
      setPageTags((current) => current.filter((item) => item.id !== tag.id))
      toast.success(t('tags.deleted'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('tags.deleteFailed')))
    } finally {
      setPendingTagId(null)
    }
  }

  function resetCreateForm() {
    setNewTagName('')
    setNewTagColor(DEFAULT_TAG_COLOR)
  }

  async function handleCreate() {
    const name = newTagName.trim()
    if (!name) {
      return
    }
    setCreating(true)
    try {
      const tag = await createTag(name, newTagColor)
      await tagPage(pageId, tag.id)
      setAllTags((current) => [...current, tag])
      setPageTags((current) => [...current, tag])
      setStatus('ready')
      setCreateOpen(false)
      resetCreateForm()
      toast.success(t('tags.created'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('tags.createFailed')))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Field>
      <FieldLabel>{t('tags.title')}</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        {status === 'loading' && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
        {status === 'error' && <p className="text-sm text-destructive">{t('tags.loadFailed')}</p>}
        {status === 'ready' && pageTags.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('tags.none')}</p>
        )}
        {pageTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs uppercase"
            style={{ borderColor: tag.color, color: tag.color }}
          >
            {tag.name}
            {canManageTags && (
              <button
                type="button"
                onClick={() => handleDetach(tag.id)}
                disabled={pendingTagId === tag.id}
                aria-label={t('tags.detachSr', { name: tag.name })}
                className="hover:opacity-70 disabled:opacity-50"
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
      </div>

      {canManageTags && (
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPickerOpen(true)}
            disabled={status !== 'ready'}
          >
            <TagIcon /> {t('tags.addExisting')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCreateOpen(true)}
            disabled={status === 'loading'}
          >
            <Plus /> {t('tags.createNew')}
          </Button>
        </div>
      )}

      <CommandDialog open={pickerOpen} onOpenChange={setPickerOpen} title={t('tags.pickerTitle')}>
        <Command>
          <CommandInput placeholder={t('tags.searchPlaceholder')} />
          <CommandList>
            <CommandEmpty>{t('tags.noTagFound')}</CommandEmpty>
            <CommandGroup>
              {attachableTags.map((tag) => (
                <CommandItem
                  key={tag.id}
                  value={tag.name}
                  onSelect={() => handleAttach(tag.id)}
                  className={canDeleteTags ? 'pr-8' : undefined}
                >
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                  {canDeleteTags && (
                    <button
                      type="button"
                      className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-destructive"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleDelete(tag)
                      }}
                      aria-label={t('tags.deleteSr', { name: tag.name })}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>

      <Dialog
        open={createOpen}
        onOpenChange={(next) => {
          setCreateOpen(next)
          if (!next) resetCreateForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tags.createTitle')}</DialogTitle>
            <DialogDescription>{t('tags.createDescription')}</DialogDescription>
          </DialogHeader>

          <Field>
            <FieldLabel htmlFor="new-tag-name">{t('tags.nameLabel')}</FieldLabel>
            <Input
              id="new-tag-name"
              value={newTagName}
              onChange={(event) => setNewTagName(event.target.value)}
              placeholder={t('tags.namePlaceholder')}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="new-tag-color">{t('tags.colorLabel')}</FieldLabel>
            <Input
              id="new-tag-color"
              type="color"
              className="h-8 w-16 p-1"
              value={newTagColor}
              onChange={(event) => setNewTagColor(event.target.value)}
            />
          </Field>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="button" disabled={!newTagName.trim() || creating} onClick={handleCreate}>
              {t('tags.createSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Field>
  )
}
