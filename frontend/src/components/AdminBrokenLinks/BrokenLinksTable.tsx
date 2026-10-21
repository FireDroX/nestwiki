import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ResponsiveTable, type ResponsiveColumn } from '#components/ResponsiveTable'
import type { BrokenPageLink } from '#api/admin-links'

interface BrokenLinksTableProps {
  items: BrokenPageLink[]
}

export function BrokenLinksTable({ items }: BrokenLinksTableProps) {
  const { t } = useTranslation()

  const columns: ResponsiveColumn<BrokenPageLink>[] = [
    {
      id: 'source',
      header: t('admin.brokenLinks.columnSource'),
      primary: true,
      className: 'whitespace-normal',
      cell: (item) => (
        <div className="flex min-w-0 flex-col">
          <Link to={`/edit${item.sourcePage.path}`} className="font-medium text-primary hover:underline">
            {item.sourcePage.title}
          </Link>
          <span className="font-mono text-xs break-all text-muted-foreground">{item.sourcePage.path}</span>
        </div>
      ),
    },
    {
      id: 'target',
      header: t('admin.brokenLinks.columnTarget'),
      className: 'font-mono break-all whitespace-normal text-destructive',
      cell: (item) => item.targetPath,
    },
  ]

  return (
    <ResponsiveTable
      columns={columns}
      rows={items}
      rowKey={(item) => `${item.sourcePage.id}:${item.targetPath}`}
      empty={<p className="text-sm text-muted-foreground">{t('admin.brokenLinks.empty')}</p>}
    />
  )
}
