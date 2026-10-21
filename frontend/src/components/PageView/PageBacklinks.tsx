import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { usePageBacklinks } from '#hooks/usePageBacklinks'
import { usePageTree } from '#hooks/usePageTree'
import { findNodeByPath } from '#utils/page-tree'

interface PageBacklinksProps {
  pageId: string
}

export function PageBacklinks({ pageId }: PageBacklinksProps) {
  const { t } = useTranslation()
  const backlinks = usePageBacklinks(pageId)
  const { tree } = usePageTree()

  if (backlinks.length === 0) {
    return null
  }

  function ancestorTitles(path: string): string {
    const nodes = findNodeByPath(tree, path.split('/').filter(Boolean))
    return (nodes ?? []).slice(0, -1).map((node) => node.title).join(' / ')
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">{t('pageView.backlinksTitle')}</h2>
      <ul className="space-y-1.5">
        {backlinks.map((backlink) => {
          const breadcrumb = ancestorTitles(backlink.path)
          return (
            <li key={backlink.id} className="min-w-0 text-sm">
              <Link to={`/pages${backlink.path}`} className="font-medium text-primary hover:underline">
                {backlink.title}
              </Link>
              {breadcrumb && <p className="truncate text-xs text-muted-foreground">{breadcrumb}</p>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
