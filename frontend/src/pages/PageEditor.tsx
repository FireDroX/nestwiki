import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { EditorLayout } from '#components/PageEditor/EditorLayout'
import { FileUploadButton } from '#components/PageEditor/FileUploadButton'
import { MarkdownEditor, type MarkdownEditorHandle } from '#components/PageEditor/MarkdownEditor'
import { MediaLibraryPicker } from '#components/PageEditor/MediaLibraryPicker'
import { PageMetadataForm } from '#components/PageEditor/PageMetadataForm'
import { PageTagsPanel } from '#components/page-settings/PageTagsPanel'
import { Button } from '#components/ui/button'
import { Field, FieldLabel } from '#components/ui/field'
import { FormError } from '#components/FormError'
import { Skeleton } from '#components/ui/skeleton'
import { Textarea } from '#components/ui/textarea'
import {
  changePageVisibility,
  movePage,
  setCommentsEnabled,
  updatePage,
  type PageVisibility,
} from '#api/pages'
import { useEditorState } from '#hooks/useEditorState'
import { useFileUpload } from '#hooks/useFileUpload'
import { usePage } from '#hooks/usePage'
import { usePageRealtimeSync } from '#hooks/usePageRealtimeSync'
import { usePageTree } from '#hooks/usePageTree'
import { usePermissions } from '#hooks/usePermissions'
import { extractErrorMessage } from '#lib/api-errors'
import { findPathToNode } from '#utils/page-tree'
import { createPageMetadataSchema, type PageMetadataFormValues } from '#schemas/page-metadata.schema'

function pathFromParam(param: string | undefined): string[] {
  return (param ?? '').split('/').filter(Boolean)
}

function PageEditorSkeleton() {
  return (
    <div className="max-w-3xl space-y-6 p-8">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

export function PageEditor() {
  const { t } = useTranslation()
  const params = useParams()
  const navigate = useNavigate()
  const { hasGlobal, canOnPage } = usePermissions()
  const pathSegments = pathFromParam(params['*'])
  const initialReturnPath = `/pages/${pathSegments.join('/')}`
  const { status, page } = usePage(pathSegments)
  const { tree, refresh } = usePageTree()
  const editor = useEditorState()
  const editorRef = useRef<MarkdownEditorHandle>(null)
  const handleImageUpload = useFileUpload(editorRef, page?.id)
  const handleAttachmentUpload = useFileUpload(editorRef, page?.id)
  const [changeSummary, setChangeSummary] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [currentParentId, setCurrentParentId] = useState<string | null>(null)
  const [commentsEnabled, setCommentsEnabledState] = useState(true)
  const [baseVersionId, setBaseVersionId] = useState('')
  const schema = useMemo(() => createPageMetadataSchema(t), [t])

  const { control, setValue, watch, getValues, reset } = useForm<PageMetadataFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', slug: '', visibility: 'private', parentId: null },
  })

  const returnPath = page
    ? (() => {
        const ancestors = currentParentId
          ? (findPathToNode(tree, (node) => node.id === currentParentId) ?? [])
          : []
        return `/pages/${[...ancestors.map((node) => node.slug), page.slug].join('/')}`
      })()
    : initialReturnPath

  useEffect(() => {
    if (page) {
      editor.reset(page.title, page.content)
      reset({ title: page.title, slug: page.slug, visibility: page.visibility, parentId: page.parentId })
      setCurrentParentId(page.parentId)
      setCommentsEnabledState(page.commentsEnabled)
      setBaseVersionId(page.currentVersionId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  usePageRealtimeSync(page?.id, {
    getBaseVersionId: () => baseVersionId,
    getContent: () => editor.content,
    onMergeResult: (result) => {
      editor.setContent(result.mergedContent)
      setBaseVersionId(result.newBaseVersionId)
      if (!result.conflict) {
        toast.success(t('pageEditor.realtimeMergedToast'))
      }
    },
  })

  async function handleParentChange(newParentId: string | null) {
    if (!page) {
      return
    }
    try {
      await movePage(page.id, newParentId)
      await refresh()
      setCurrentParentId(newParentId)
      toast.success(t('pageEditor.pageMoved'))
    } catch (error) {
      setValue('parentId', currentParentId)
      toast.error(extractErrorMessage(error, t('pageEditor.moveFailed')))
    }
  }

  async function handleVisibilityChange(nextVisibility: PageVisibility) {
    if (!page) {
      return
    }
    const previousVisibility = getValues('visibility')
    try {
      await changePageVisibility(page.id, nextVisibility)
      toast.success(t('pageEditor.visibilityChanged'))
    } catch (error) {
      setValue('visibility', previousVisibility)
      toast.error(extractErrorMessage(error, t('pageEditor.visibilityChangeFailed')))
    }
  }

  async function handleCommentsEnabledChange(nextCommentsEnabled: boolean) {
    if (!page) {
      return
    }
    const previousCommentsEnabled = commentsEnabled
    setCommentsEnabledState(nextCommentsEnabled)
    try {
      await setCommentsEnabled(page.id, nextCommentsEnabled)
      toast.success(
        nextCommentsEnabled ? t('pageEditor.commentsEnabled') : t('pageEditor.commentsDisabled'),
      )
    } catch (error) {
      setCommentsEnabledState(previousCommentsEnabled)
      toast.error(extractErrorMessage(error, t('pageEditor.commentsEnabledChangeFailed')))
    }
  }

  async function submitSave() {
    if (!page || isSaving) {
      return
    }
    setIsSaving(true)
    setSaveError(null)
    try {
      const result = await updatePage(page.id, {
        title: getValues('title'),
        content: editor.content,
        changeSummary: changeSummary || undefined,
        baseVersionId,
      })

      if (result.conflict) {
        editor.setContent(result.mergedContent ?? editor.content)
        setBaseVersionId(result.currentVersionId)
        toast.error(t('pageEditor.realtimeConflictBanner'))
        return
      }

      setBaseVersionId(result.currentVersionId)
      editor.markSaved()
      toast.success(t('pageEditor.pageSaved'))
      navigate(returnPath)
    } catch (error) {
      setSaveError(extractErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  function handleCancel() {
    if (editor.isDirty && !window.confirm(t('pageEditor.discardConfirmEdit'))) {
      return
    }
    navigate(returnPath)
  }

  if (status === 'loading') {
    return <PageEditorSkeleton />
  }

  if (status !== 'success' || !page) {
    return (
      <div className="max-w-3xl space-y-4 p-8">
        <h1 className="text-2xl font-semibold">{t('pageEditor.notFoundTitle')}</h1>
        <p className="text-muted-foreground">{t('pageEditor.notFoundDescription')}</p>
        <Button onClick={() => navigate('/')}>{t('pageView.backHome')}</Button>
      </div>
    )
  }

  if (!canOnPage(page, 'page.edit')) {
    return (
      <div className="max-w-3xl space-y-4 p-8">
        <h1 className="text-2xl font-semibold">{t('pageEditor.forbiddenTitle')}</h1>
        <p className="text-muted-foreground">{t('pageEditor.forbiddenDescription')}</p>
        <Button onClick={() => navigate('/')}>{t('pageView.backHome')}</Button>
      </div>
    )
  }

  return (
    <EditorLayout
      backTo={returnPath}
      title={t('pageEditor.editTitle', { title: page.title })}
      actions={
        <>
          <Button type="button" variant="ghost" onClick={handleCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={() => submitSave()} disabled={isSaving}>
            {isSaving ? t('pageEditor.saving') : t('pageEditor.save')}
          </Button>
        </>
      }
      sidebar={
        <>
          <PageMetadataForm
            mode="edit"
            control={control}
            setValue={setValue}
            watch={watch}
            excludePageId={page.id}
            commentsEnabled={commentsEnabled}
            onParentChange={handleParentChange}
            onVisibilityChange={handleVisibilityChange}
            onCommentsEnabledChange={handleCommentsEnabledChange}
          />
          <Field className="mt-5">
            <FieldLabel htmlFor="change-summary">{t('pageEditor.changeSummaryLabel')}</FieldLabel>
            <Textarea
              id="change-summary"
              value={changeSummary}
              onChange={(event) => setChangeSummary(event.target.value)}
              placeholder={t('pageEditor.changeSummaryPlaceholder')}
              rows={3}
            />
          </Field>
          <div className="mt-5">
            <PageTagsPanel
              pageId={page.id}
              canManageTags={canOnPage(page, 'page.manage_tags')}
              canCreateTags={hasGlobal('tag.create')}
              canDeleteTags={hasGlobal('tag.delete')}
            />
          </div>
          {editor.content.includes('<<<<<<<') && (
            <p className="mt-2 text-sm text-destructive">{t('pageEditor.realtimeConflictBanner')}</p>
          )}
          <FormError message={saveError} />
        </>
      }
    >
      <MarkdownEditor
        ref={editorRef}
        value={editor.content}
        onChange={editor.setContent}
        onSave={() => submitSave()}
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
              pageId={page.id}
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
