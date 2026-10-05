import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Bold, Code, Eye, Italic, Link2, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MarkdownRenderer } from '#components/MarkdownRenderer'
import { Button } from '#components/ui/button'
import { Separator } from '#components/ui/separator'
import { Textarea } from '#components/ui/textarea'
import { useDebouncedValue } from '#hooks/useDebouncedValue'
import { cn } from '#lib/utils'

const PREVIEW_DEBOUNCE_MS = 200

export interface MarkdownEditorHandle {
  insertAtCursor: (text: string) => void
  replaceText: (search: string, replacement: string) => void
}

interface Selection {
  start: number
  end: number
}

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  onSave: () => void
  toolbarExtra?: ReactNode
  onFilesDropped?: (files: FileList) => void
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor({ value, onChange, onSave, toolbarExtra, onFilesDropped }, ref) {
    const { t } = useTranslation()
    const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit')
    const [isDraggingOver, setIsDraggingOver] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const debouncedValue = useDebouncedValue(value, PREVIEW_DEBOUNCE_MS)

    function currentSelection(): Selection {
      const textarea = textareaRef.current
      return {
        start: textarea?.selectionStart ?? value.length,
        end: textarea?.selectionEnd ?? value.length,
      }
    }

    function focusSelection(start: number, end: number) {
      requestAnimationFrame(() => {
        const textarea = textareaRef.current
        textarea?.focus()
        textarea?.setSelectionRange(start, end)
      })
    }

    function insertAtCursor(text: string) {
      const { start, end } = currentSelection()
      onChange(value.slice(0, start) + text + value.slice(end))
      focusSelection(start + text.length, start + text.length)
    }

    function wrapSelection(before: string, after: string = before) {
      const { start, end } = currentSelection()
      const selected = value.slice(start, end)
      onChange(value.slice(0, start) + before + selected + after + value.slice(end))
      if (selected) {
        focusSelection(start + before.length, start + before.length + selected.length)
      } else {
        focusSelection(start + before.length, start + before.length)
      }
    }

    function insertLink() {
      const { start, end } = currentSelection()
      const selected = value.slice(start, end) || t('markdownEditor.linkPlaceholder')
      const snippet = `[${selected}](url)`
      onChange(value.slice(0, start) + snippet + value.slice(end))
      const urlStart = start + selected.length + 3
      focusSelection(urlStart, urlStart + 3)
    }

    useImperativeHandle(
      ref,
      () => ({
        insertAtCursor,
        replaceText(search: string, replacement: string) {
          onChange(value.replace(search, replacement))
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [value, onChange],
    )

    useEffect(() => {
      function handleKeyDown(event: KeyboardEvent) {
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
          event.preventDefault()
          onSave()
        }
      }

      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onSave])

    function handleDrop(event: React.DragEvent<HTMLDivElement>) {
      event.preventDefault()
      setIsDraggingOver(false)
      if (event.dataTransfer.files.length > 0) {
        onFilesDropped?.(event.dataTransfer.files)
      }
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
          <div className="flex flex-wrap items-center gap-0.5">
            <Button type="button" variant="ghost" size="icon-sm" title={t('markdownEditor.bold')} onClick={() => wrapSelection('**')}>
              <Bold />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" title={t('markdownEditor.italic')} onClick={() => wrapSelection('_')}>
              <Italic />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" title={t('markdownEditor.code')} onClick={() => wrapSelection('`')}>
              <Code />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" title={t('markdownEditor.link')} onClick={insertLink}>
              <Link2 />
            </Button>
            {toolbarExtra && (
              <>
                <Separator orientation="vertical" className="mx-1 h-5" />
                {toolbarExtra}
              </>
            )}
          </div>
          <div className="flex items-center gap-1 lg:hidden">
            <Button
              type="button"
              variant={mobileView === 'edit' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setMobileView('edit')}
            >
              <Pencil /> {t('markdownEditor.editTab')}
            </Button>
            <Button
              type="button"
              variant={mobileView === 'preview' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setMobileView('preview')}
            >
              <Eye /> {t('markdownEditor.previewTab')}
            </Button>
          </div>
        </div>
        <div className="grid min-h-0 flex-1 lg:grid-cols-2">
          <div
            className={cn(
              'relative border-border lg:block lg:border-r',
              mobileView === 'preview' && 'hidden',
              isDraggingOver && 'ring-2 ring-inset ring-primary',
            )}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDraggingOver(true)
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={handleDrop}
          >
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={t('markdownEditor.contentPlaceholder')}
              className="field-sizing-fixed h-full min-h-[60vh] resize-none rounded-none border-0 px-5 py-4 font-mono text-sm shadow-none focus-visible:ring-0"
            />
          </div>
          <div
            className={cn(
              'min-h-[60vh] overflow-y-auto px-5 py-4 lg:block',
              mobileView === 'edit' && 'hidden',
            )}
          >
            <MarkdownRenderer content={debouncedValue} mode="full" />
          </div>
        </div>
      </div>
    )
  },
)
