import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ImportFileStep } from '#components/Import/ImportFileStep'
import { ImportPreviewStep } from '#components/Import/ImportPreviewStep'
import { ImportProgress } from '#components/Import/ImportProgress'
import { ImportReportStep } from '#components/Import/ImportReportStep'
import { ImportSteps } from '#components/Import/ImportSteps'
import {
  previewImport,
  runImport,
  type ImportConflictMode,
  type ImportPlan,
  type ImportReport,
} from '#api/imports'
import type { PageVisibility } from '#api/pages'
import { usePermissions } from '#hooks/usePermissions'
import { extractErrorMessage } from '#lib/api-errors'
import type { ImportStep } from '#utils/import'
import { PAGE_PADDING } from '#utils/page-layout'

export function ImportWizard() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const { hasGlobal } = usePermissions()
  const [step, setStep] = useState<ImportStep>('file')
  const [file, setFile] = useState<File | null>(null)
  const [parentId, setParentId] = useState<string | null>(searchParams.get('parent'))
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [visibility, setVisibility] = useState<PageVisibility>('private')
  const [createMissingTags, setCreateMissingTags] = useState(false)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadPlan(conflict: ImportConflictMode) {
    if (!file) return
    setPending(true)
    setError(null)
    try {
      setPlan(await previewImport(file, parentId, conflict))
      setStep('preview')
    } catch (previewError) {
      setError(extractErrorMessage(previewError))
    } finally {
      setPending(false)
    }
  }

  async function startImport() {
    if (!file || !plan) return
    setStep('import')
    setUploadPercent(0)
    setError(null)
    try {
      setReport(
        await runImport(
          file,
          { parentId, conflict: plan.conflictMode, visibility, createMissingTags },
          setUploadPercent,
        ),
      )
      setStep('report')
    } catch (importError) {
      setError(extractErrorMessage(importError))
      setStep('preview')
    }
  }

  function restart() {
    setFile(null)
    setPlan(null)
    setReport(null)
    setVisibility('private')
    setCreateMissingTags(false)
    setError(null)
    setStep('file')
  }

  return (
    <div className={`${PAGE_PADDING} mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-6`}>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t('import.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('import.intro')}</p>
      </div>
      <ImportSteps current={step} />
      {step === 'file' && (
        <ImportFileStep
          file={file}
          parentId={parentId}
          canImportAtRoot={hasGlobal('page.create_root')}
          pending={pending}
          error={error}
          onFileChange={(nextFile) => {
            setFile(nextFile)
            setError(null)
          }}
          onParentChange={setParentId}
          onAnalyze={() => void loadPlan(plan?.conflictMode ?? 'skip')}
        />
      )}
      {step === 'preview' && plan && (
        <ImportPreviewStep
          plan={plan}
          visibility={visibility}
          createMissingTags={createMissingTags}
          pending={pending}
          error={error}
          onConflictChange={(conflict) => void loadPlan(conflict)}
          onVisibilityChange={setVisibility}
          onCreateMissingTagsChange={setCreateMissingTags}
          onBack={() => {
            setError(null)
            setStep('file')
          }}
          onImport={() => void startImport()}
        />
      )}
      {step === 'import' && <ImportProgress percent={uploadPercent} />}
      {step === 'report' && report && <ImportReportStep report={report} onRestart={restart} />}
    </div>
  )
}
