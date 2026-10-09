import { useTranslation } from 'react-i18next'
import { ChevronDown, ListTree } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#components/ui/collapsible'
import type { TocHeading } from '#utils/table-of-contents'
import { cn } from '#lib/utils'

const LEVEL_INDENT_CLASSES = ['pl-0', 'pl-3', 'pl-6']

interface TableOfContentsListProps {
  headings: TocHeading[]
  activeId: string | null
}

function TableOfContentsList({ headings, activeId }: TableOfContentsListProps) {
  const minLevel = Math.min(...headings.map((heading) => heading.level))

  return (
    <ul className="space-y-1 text-sm">
      {headings.map((heading) => (
        <li key={heading.id} className={LEVEL_INDENT_CLASSES[heading.level - minLevel]}>
          <a
            href={`#${heading.id}`}
            aria-current={heading.id === activeId ? 'location' : undefined}
            className={cn(
              'block truncate rounded-sm py-0.5 text-muted-foreground transition-colors hover:text-foreground',
              heading.id === activeId && 'font-medium text-primary hover:text-primary',
            )}
          >
            {heading.text}
          </a>
        </li>
      ))}
    </ul>
  )
}

export function TableOfContentsSidebar({ headings, activeId }: TableOfContentsListProps) {
  const { t } = useTranslation()

  return (
    <nav aria-label={t('markdown.toc')} className="sticky top-6 max-h-[calc(100vh-8rem)] space-y-2 overflow-y-auto">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('markdown.toc')}</p>
      <TableOfContentsList headings={headings} activeId={activeId} />
    </nav>
  )
}

export function TableOfContentsCollapsible({ headings, activeId }: TableOfContentsListProps) {
  const { t } = useTranslation()

  return (
    <Collapsible className="rounded-md border border-border">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-3 py-2 text-sm font-medium">
        <ListTree className="size-4" aria-hidden />
        {t('markdown.toc')}
        <ChevronDown className="ml-auto size-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <nav aria-label={t('markdown.toc')} className="border-t border-border px-3 py-2">
          <TableOfContentsList headings={headings} activeId={activeId} />
        </nav>
      </CollapsibleContent>
    </Collapsible>
  )
}
