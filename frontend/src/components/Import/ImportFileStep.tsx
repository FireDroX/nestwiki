import { useRef, useState } from 'react'
import { FileArchive, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '#components/ui/button'
import { Field, FieldDescription, FieldLabel } from '#components/ui/field'
import { FormError } from '#components/FormError'
import {
  IMPORT_ACCEPTED_EXTENSIONS,
  IMPORT_MAX_ARCHIVE_SIZE_MB,
  IMPORT_MAX_PAGES,
  IMPORT_MAX_UNCOMPRESSED_SIZE_MB,
} from '#api/imports'
import { cn } from '#lib/utils'
import { formatFileSize } from '#utils/file-size'
import { ImportDestinationPicker } from './ImportDestinationPicker'

interface ImportFileStepProps {
  file: File | null
  parentId: string | null
  canImportAtRoot: boolean
  pending: boolean
  error: string | null
  onFileChange: (file: File) => void
  onParentChange: (parentId: string | null) => void
  onAnalyze: () => void
}

const MAX_ARCHIVE_SIZE_BYTES = IMPORT_MAX_ARCHIVE_SIZE_MB * 1024 * 1024

export function ImportFileStep({
  file,
  parentId,
  canImportAtRoot,
  pending,
  error,
  onFileChange,
  onParentChange,
  onAnalyze,
}: ImportFileStepProps) {
  const { t, i18n } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const hasDestination = parentId !== null || canImportAtRoot

  function pick(candidate: File | undefined) {
    if (!candidate) return
    const name = candidate.name.toLowerCase()
    if (!IMPORT_ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension))) {
      setFileError(t('import.file.invalidType'))
      return
    }
    if (candidate.size > MAX_ARCHIVE_SIZE_BYTES) {
      setFileError(t('import.file.tooLarge', { size: IMPORT_MAX_ARCHIVE_SIZE_MB }))
      return
    }
    setFileError(null)
    onFileChange(candidate)
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        data-testid="import-dropzone"
        className={cn(
          'flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border px-4 py-8 text-center',
          isDraggingOver && 'border-primary bg-primary/5',
        )}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDraggingOver(true)
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDraggingOver(false)
          pick(event.dataTransfer.files[0])
        }}
      >
        {file ? (
          <p className="flex max-w-full items-center gap-2 text-sm font-medium">
            <FileArchive className="size-4 shrink-0" />
            <span className="truncate">{file.name}</span>
            <span className="shrink-0 text-muted-foreground">({formatFileSize(file.size, i18n.language)})</span>
          </p>
        ) : (
          <>
            <Upload className="size-8 text-muted-foreground" />
            <p className="text-sm">{t('import.file.dropzone')}</p>
          </>
        )}
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
          {file ? t('import.file.change') : t('import.file.choose')}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={IMPORT_ACCEPTED_EXTENSIONS.join(',')}
          className="hidden"
          data-testid="import-file-input"
          onChange={(event) => {
            pick(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </div>
      <div className="text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{t('import.file.formatsTitle')}</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>{t('import.file.formatObsidian')}</li>
          <li>{t('import.file.formatMarkdown')}</li>
          <li>{t('import.file.formatNestwiki')}</li>
        </ul>
        <p className="mt-2">
          {t('import.file.limits', {
            archive: IMPORT_MAX_ARCHIVE_SIZE_MB,
            uncompressed: IMPORT_MAX_UNCOMPRESSED_SIZE_MB,
            pages: IMPORT_MAX_PAGES.toLocaleString(i18n.language),
          })}
        </p>
      </div>
      <Field>
        <FieldLabel>{t('import.file.destinationLabel')}</FieldLabel>
        <ImportDestinationPicker
          value={parentId}
          onChange={onParentChange}
          canImportAtRoot={canImportAtRoot}
          disabled={pending}
        />
        <FieldDescription>{t('import.file.destinationHint')}</FieldDescription>
      </Field>
      <FormError message={fileError ?? error} />
      <div className="flex justify-end">
        <Button type="button" disabled={!file || !hasDestination || pending} onClick={onAnalyze}>
          {pending ? t('import.file.analyzing') : t('import.file.analyze')}
        </Button>
      </div>
    </div>
  )
}
