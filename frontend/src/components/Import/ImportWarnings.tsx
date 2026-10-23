import type { ReactNode } from 'react'
import { ChevronRight, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#components/ui/collapsible'
import type { ImportWarnings as ImportWarningsData } from '#api/imports'
import { hasImportWarnings } from '#utils/import'

interface ImportWarningsProps {
  warnings: ImportWarningsData
}

interface WarningGroupProps {
  title: string
  children: ReactNode
}

function WarningGroup({ title, children }: WarningGroupProps) {
  return (
    <Collapsible className="rounded-md border border-border">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium">
        <ChevronRight className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="space-y-1 border-t border-border px-3 py-2 text-sm text-muted-foreground">{children}</ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function ImportWarnings({ warnings }: ImportWarningsProps) {
  const { t } = useTranslation()

  if (!hasImportWarnings(warnings)) {
    return null
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" />
        {t('import.warnings.title')}
      </h2>
      {warnings.mediaWithoutUpload > 0 && (
        <p className="text-sm text-muted-foreground">
          {t('import.warnings.mediaWithoutUpload', { count: warnings.mediaWithoutUpload })}
        </p>
      )}
      {warnings.unresolvedLinks.length > 0 && (
        <WarningGroup title={t('import.warnings.unresolvedLinks', { count: warnings.unresolvedLinks.length })}>
          {warnings.unresolvedLinks.map((link, index) => (
            <li key={`${link.page}-${link.target}-${index}`} className="break-words">
              {t('import.warnings.unresolvedLink', { page: link.page, target: link.target })}
            </li>
          ))}
        </WarningGroup>
      )}
      {warnings.ignoredFiles.length > 0 && (
        <WarningGroup title={t('import.warnings.ignoredFiles', { count: warnings.ignoredFiles.length })}>
          {warnings.ignoredFiles.map((file) => (
            <li key={file.file} className="break-words">
              {file.file} — {t(`import.warnings.ignoredReasons.${file.reason}`)}
            </li>
          ))}
        </WarningGroup>
      )}
      {warnings.missingTags.length > 0 && (
        <WarningGroup title={t('import.warnings.missingTags', { count: warnings.missingTags.length })}>
          <li>{t('import.warnings.missingTagsHint')}</li>
          <li className="break-words">{warnings.missingTags.join(', ')}</li>
        </WarningGroup>
      )}
      {warnings.renamedSlugs.length > 0 && (
        <WarningGroup title={t('import.warnings.renamedSlugs', { count: warnings.renamedSlugs.length })}>
          {warnings.renamedSlugs.map((renamed) => (
            <li key={renamed.page} className="break-words">
              {t('import.warnings.renamedSlug', { from: renamed.from, page: renamed.page })} (
              {t(`import.warnings.renameReasons.${renamed.reason}`)})
            </li>
          ))}
        </WarningGroup>
      )}
    </section>
  )
}
