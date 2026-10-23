import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '#components/ui/button'
import type { ImportReport } from '#api/imports'
import { ImportWarnings } from './ImportWarnings'

interface ImportReportStepProps {
  report: ImportReport
  onRestart: () => void
}

export function ImportReportStep({ report, onRestart }: ImportReportStepProps) {
  const { t } = useTranslation()
  const counters = [
    { key: 'created', value: report.created.length },
    { key: 'updated', value: report.updated.length },
    { key: 'skipped', value: report.skipped.length },
    { key: 'media', value: report.media.uploaded },
    { key: 'tags', value: report.tags.created.length },
  ]

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">{t('import.report.title')}</h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {counters.map((counter) => (
          <div key={counter.key} className="rounded-lg border border-border p-3">
            <dt className="text-xs text-muted-foreground">{t(`import.report.${counter.key}`)}</dt>
            <dd className="text-2xl font-semibold" data-testid={`import-report-${counter.key}`}>
              {counter.value}
            </dd>
          </div>
        ))}
      </dl>
      {report.skipped.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t('import.report.skippedTitle')}</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {report.skipped.map((page) => (
              <li key={page.path} className="break-words">
                {page.path} — {t(`import.report.skippedReasons.${page.reason}`)}
              </li>
            ))}
          </ul>
        </section>
      )}
      <ImportWarnings warnings={report.warnings} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={onRestart}>
          {t('import.report.again')}
        </Button>
        <Button asChild>
          <Link to={report.rootPath ? `/pages${report.rootPath}` : '/'}>{t('import.report.open')}</Link>
        </Button>
      </div>
    </div>
  )
}
