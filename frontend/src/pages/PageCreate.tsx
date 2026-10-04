import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { EditorLayout } from '#components/PageEditor/EditorLayout'
import { FileUploadButton } from '#components/PageEditor/FileUploadButton'
import { MarkdownEditor, type MarkdownEditorHandle } from '#components/PageEditor/MarkdownEditor'
import { MediaLibraryPicker } from '#components/PageEditor/MediaLibraryPicker'
import { PageMetadataForm } from '#components/PageEditor/PageMetadataForm'
import { Button } from '#components/ui/button'
import { FormError } from '#components/FormError'
import { createPage } from '#api/pages'
import { useEditorState } from '#hooks/useEditorState'
import { useFileUpload } from '#hooks/useFileUpload'
import { usePageTree } from '#hooks/usePageTree'
import { usePermissions } from '#hooks/usePermissions'
import { extractErrorMessage } from '#lib/api-errors'
import { findPathToNode } from '#utils/page-tree'
import { createPageMetadataSchema, type PageMetadataFormValues } from '#schemas/page-metadata.schema'

export function PageCreate() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { tree, refresh } = usePageTree()
  const { hasGlobal } = usePermissions()
  const editor = useEditorState()
  const editorRef = useRef<MarkdownEditorHandle>(null)
  const handleImageUpload = useFileUpload(editorRef, undefined)
  const handleAttachmentUpload = useFileUpload(editorRef, undefined)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const schema = useMemo(() => createPageMetadataSchema(t, 'create'), [t])

  const { control, setValue, watch, handleSubmit } = useForm<PageMetadataFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      slug: '',
      visibility: 'private',
      parentId: searchParams.get('parent'),
    },
  })

  function submit() {
    return handleSubmit(async (values) => {
      setIsSaving(true)
      setSaveError(null)
      try {
        const created = await createPage({ ...values, content: editor.content })
        const ancestors = values.parentId
          ? (findPathToNode(tree, (node) => node.id === values.parentId) ?? [])
          : []
        const path = [...ancestors.map((node) => node.slug), created.slug].join('/')
        editor.markSaved()
        await refresh()
        navigate(`/pages/${path}`)
      } catch (error) {
        setSaveError(extractErrorMessage(error))
      } finally {
        setIsSaving(false)
      }
    })
  }

  function handleCancel() {
    if (editor.isDirty && !window.confirm(t('pageEditor.discardConfirmCreate'))) {
      return
    }
    navigate('/')
  }

  return (
    <EditorLayout
      backTo="/"
      title={t('pageEditor.newPageTitle')}
      actions={
        <>
          <Button type="button" variant="ghost" onClick={handleCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={submit()} disabled={isSaving}>
            {isSaving ? t('pageEditor.creating') : t('pageEditor.create')}
          </Button>
        </>
      }
      sidebar={
        <>
          <PageMetadataForm mode="create" control={control} setValue={setValue} watch={watch} />
          <FormError message={saveError} />
        </>
      }
    >
      <MarkdownEditor
        ref={editorRef}
        value={editor.content}
        onChange={editor.setContent}
        onSave={submit()}
        onFilesDropped={handleImageUpload}
        toolbarExtra={
          <>
            {hasGlobal('media.upload') && (
              <>
                <FileUploadButton variant="image" onFilesSelected={handleImageUpload} />
                <FileUploadButton variant="attachment" onFilesSelected={handleAttachmentUpload} />
              </>
            )}
            <MediaLibraryPicker
              canUpload={hasGlobal('media.upload')}
              canDelete={hasGlobal('media.delete')}
              onInsert={(markdown) => editorRef.current?.insertAtCursor(markdown)}
            />
          </>
        }
      />
    </EditorLayout>
  )
}
