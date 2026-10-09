import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ListTree } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#components/ui/collapsible'
import { buildTocTree, type TocHeading, type TocNode } from '#utils/table-of-contents'
import { cn } from '#lib/utils'

interface TableOfContentsListProps {
  headings: TocHeading[]
  activeId: string | null
}

interface TocBranchProps {
  nodes: TocNode[]
  activeId: string | null
  nested?: boolean
}

function TocBranch({ nodes, activeId, nested = false }: TocBranchProps) {
  return (
    <ul className={cn('flex flex-col gap-[9px]', nested && 'mt-[9px] ml-1 border-l border-border pl-3')}>
      {nodes.map(({ heading, children }) => (
        <li key={heading.id}>
          <a
            href={`#${heading.id}`}
            aria-current={heading.id === activeId ? 'location' : undefined}
            className={cn(
              'block text-foreground opacity-70 transition-opacity hover:opacity-100',
              heading.id === activeId && 'text-primary opacity-100',
            )}
          >
            {heading.text}
          </a>
          {children.length > 0 && <TocBranch nodes={children} activeId={activeId} nested />}
        </li>
      ))}
    </ul>
  )
}

function TableOfContentsList({ headings, activeId }: TableOfContentsListProps) {
  const tree = useMemo(() => buildTocTree(headings), [headings])
  return (
    <div className="text-[13px]">
      <TocBranch nodes={tree} activeId={activeId} />
    </div>
  )
}

export function TableOfContentsSidebar({ headings, activeId }: TableOfContentsListProps) {
  const { t } = useTranslation()

  return (
    <nav aria-label={t('markdown.toc')} className="sticky top-0 max-h-[calc(100vh-3.5rem)] overflow-y-auto px-5 py-7">
      <p className="mb-2.5 text-[10px] font-semibold tracking-[.1em] text-foreground/55 uppercase">{t('markdown.toc')}</p>
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
