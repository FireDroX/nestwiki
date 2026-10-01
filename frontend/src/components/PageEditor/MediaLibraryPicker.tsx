import { useEffect, useState } from 'react'
import { Images, Paperclip, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#components/ui/tabs'
import { Button } from '#components/ui/button'
import { Input } from '#components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select'
import { MediaLibraryUploadTab } from '#components/PageEditor/MediaLibraryUploadTab'
import { PdfPreview } from '#components/PdfPreview'
import { deleteMedia, listMediaLibrary, mediaRawUrl, type AttachmentDto } from '#api/media'
import { useDebouncedValue } from '#hooks/useDebouncedValue'
import { extractErrorMessage } from '#lib/api-errors'

const PAGE_SIZE = 24
const SEARCH_DEBOUNCE_MS = 300

function toMarkdown(item: AttachmentDto): string {
  const url = mediaRawUrl(item.id)
  return item.mimeType.startsWith('image/') ? `![${item.filename}](${url})` : `[${item.filename}](${url})`
}

interface MediaLibraryPickerProps {
  pageId?: string
  canUpload: boolean
  canDelete: boolean
  onInsert: (markdown: string) => void
}

export function MediaLibraryPicker({ pageId, canUpload, canDelete, onInsert }: MediaLibraryPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'browse' | 'upload'>('browse')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)
  const [type, setType] = useState<'all' | 'image' | 'file'>('all')
  const [items, setItems] = useState<AttachmentDto[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  async function loadPage(pageNum: number, replace: boolean) {
    setLoading(true)
    try {
      const result = await listMediaLibrary({
        search: debouncedSearch || undefined,
        type: type === 'all' ? undefined : type,
        page: pageNum,
        limit: PAGE_SIZE,
      })
      setItems((prev) => (replace ? result.items : [...prev, ...result.items]))
      setTotal(result.total)
      setPage(pageNum)
    } catch (error) {
      toast.error(extractErrorMessage(error, t('mediaLibrary.loadFailed')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) {
      return
    }
    loadPage(1, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, debouncedSearch, type])

  function handleInsert(item: AttachmentDto) {
    onInsert(toMarkdown(item))
    setOpen(false)
  }

  function handleUploaded(item: AttachmentDto) {
    handleInsert(item)
  }

  async function handleDelete(item: AttachmentDto) {
    try {
      await deleteMedia(item.id)
      setItems((prev) => prev.filter((existing) => existing.id !== item.id))
      setTotal((prev) => prev - 1)
      toast.success(t('mediaLibrary.deleteSuccess'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('mediaLibrary.deleteFailed')))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" title={t('mediaLibrary.openButton')}>
          <Images />
          <span className="sr-only">{t('mediaLibrary.openButton')}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('mediaLibrary.title')}</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(value) => setTab(value as 'browse' | 'upload')}>
          <TabsList>
            <TabsTrigger value="browse">{t('mediaLibrary.browseTab')}</TabsTrigger>
            {canUpload && <TabsTrigger value="upload">{t('mediaLibrary.uploadTab')}</TabsTrigger>}
          </TabsList>
          <TabsContent value="browse" className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('mediaLibrary.searchPlaceholder')}
              />
              <Select value={type} onValueChange={(value) => setType(value as 'all' | 'image' | 'file')}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('mediaLibrary.typeAll')}</SelectItem>
                  <SelectItem value="image">{t('mediaLibrary.typeImage')}</SelectItem>
                  <SelectItem value="file">{t('mediaLibrary.typeFile')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {items.length === 0 && !loading && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('mediaLibrary.empty')}
              </p>
            )}
            <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group relative flex flex-col overflow-hidden rounded-lg border border-border"
                >
                  <button
                    type="button"
                    className="flex flex-col text-left"
                    onClick={() => handleInsert(item)}
                    title={t('mediaLibrary.insert')}
                  >
                    <span className="flex aspect-square items-center justify-center bg-muted">
                      {item.mimeType.startsWith('image/') ? (
                        <img src={item.url} alt={item.filename} className="h-full w-full object-cover" />
                      ) : item.mimeType === 'application/pdf' ? (
                        <PdfPreview url={item.url} filename={item.filename} className="h-full w-full" />
                      ) : (
                        <Paperclip className="size-8 text-muted-foreground" />
                      )}
                    </span>
                    <span className="truncate px-2 py-1 text-xs text-muted-foreground">
                      {item.filename}
                    </span>
                  </button>
                  {canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="absolute top-1 right-1 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 />
                          <span className="sr-only">
                            {t('mediaLibrary.deleteSr', { filename: item.filename })}
                          </span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('mediaLibrary.deleteConfirmTitle')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('mediaLibrary.deleteConfirmDescription', { filename: item.filename })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                          <AlertDialogAction variant="destructive" onClick={() => handleDelete(item)}>
                            {t('common.delete')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ))}
            </div>
            {items.length < total && (
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => loadPage(page + 1, false)}
              >
                {t('mediaLibrary.loadMore')}
              </Button>
            )}
          </TabsContent>
          {canUpload && (
            <TabsContent value="upload">
              <MediaLibraryUploadTab pageId={pageId} onUploaded={handleUploaded} />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
