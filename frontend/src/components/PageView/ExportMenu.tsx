import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { downloadPageExport, type PageExportScope } from '#api/pages'
import { Button } from '#components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu'
import { extractErrorMessage } from '#lib/api-errors'
import { printWithLightDiagrams } from '#lib/print-mode'

interface ExportMenuProps {
  pageId: string
  pathSegments: string[]
  hasChildren: boolean
}

export function ExportMenu({ pageId, pathSegments, hasChildren }: ExportMenuProps) {
  const { t } = useTranslation()

  async function download(scope: PageExportScope) {
    try {
      await downloadPageExport(pageId, scope)
    } catch (error) {
      toast.error(extractErrorMessage(error, t('pageView.exportFailed')))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download /> {t('pageView.export')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto">
        <DropdownMenuItem onSelect={() => void printWithLightDiagrams()}>
          {t('pageView.exportPdfPage')}
        </DropdownMenuItem>
        {hasChildren && (
          <DropdownMenuItem onSelect={() => window.open(`/print/${pathSegments.join('/')}`, '_blank')}>
            {t('pageView.exportPdfSubtree')}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void download('page')}>{t('pageView.exportMarkdownPage')}</DropdownMenuItem>
        {hasChildren && (
          <DropdownMenuItem onSelect={() => void download('subtree')}>
            {t('pageView.exportMarkdownSubtree')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
