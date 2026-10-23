import { FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '#components/ui/badge'
import type { ImportPlanPage } from '#api/imports'
import { cn } from '#lib/utils'

interface ImportPlanTreeProps {
  pages: ImportPlanPage[]
}

function ImportPlanNode({ page }: { page: ImportPlanPage }) {
  const { t } = useTranslation()

  return (
    <li>
      <div
        data-testid="import-plan-page"
        className={cn(
          'flex min-w-0 flex-col gap-1 rounded-md px-2 py-1.5 sm:flex-row sm:items-center sm:gap-2',
          page.conflict && 'bg-amber-500/10',
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{page.title}</span>
          {page.conflict && (
            <Badge variant="outline" className="shrink-0 border-amber-500/50 text-amber-700 dark:text-amber-400">
              {t('import.preview.conflictBadge')}
            </Badge>
          )}
          {page.action !== 'create' && (
            <Badge variant="secondary" className="shrink-0">
              {t(`import.preview.actions.${page.action}`)}
            </Badge>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground sm:ml-auto sm:justify-end">
          <span className="break-all">{page.path}</span>
          {page.linkCount > 0 && <span>{t('import.preview.linkCount', { count: page.linkCount })}</span>}
          {page.mediaCount > 0 && <span>{t('import.preview.mediaCount', { count: page.mediaCount })}</span>}
          {page.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="max-w-full truncate">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
      {page.children.length > 0 && <ImportPlanTree pages={page.children} />}
    </li>
  )
}

export function ImportPlanTree({ pages }: ImportPlanTreeProps) {
  return (
    <ul className="min-w-0 space-y-0.5 [&_ul]:ml-3 [&_ul]:border-l [&_ul]:border-border [&_ul]:pl-2">
      {pages.map((page) => (
        <ImportPlanNode key={page.path} page={page} />
      ))}
    </ul>
  )
}
