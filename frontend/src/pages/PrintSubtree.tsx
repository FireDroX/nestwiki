import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { getPageByPath, getSubtreeContent, getTree, type SubtreePage } from '#api/pages'
import { MarkdownRenderer } from '#components/MarkdownRenderer'
import { Button } from '#components/ui/button'
import { useAuth } from '#hooks/useAuth'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { usePrintPreparation } from '#hooks/usePrintPreparation'
import { setPrintMode } from '#lib/print-mode'
import { findNodeByPath } from '#utils/page-tree'
import { isPrintableContentReady } from '#utils/printable-content'

const READY_CHECK_INTERVAL_MS = 200
const READY_TIMEOUT_MS = 15000

type PrintState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; pages: SubtreePage[] }

function usePrintWhenReady(rootRef: React.RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!enabled) {
      return
    }
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      const root = rootRef.current
      if (root && isPrintableContentReady(root)) {
        window.clearInterval(timer)
        setTimedOut(false)
        window.print()
      } else if (Date.now() - startedAt > READY_TIMEOUT_MS) {
        setTimedOut(true)
      }
    }, READY_CHECK_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [rootRef, enabled])

  return timedOut
}

async function resolvePageId(pathSegments: string[]): Promise<string> {
  const nodePath = findNodeByPath(await getTree(), pathSegments)
  const node = nodePath?.[nodePath.length - 1]
  return node ? node.id : (await getPageByPath(pathSegments)).id
}

export function PrintSubtree() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const params = useParams()
  const pathSegments = useMemo(() => (params['*'] ?? '').split('/').filter(Boolean), [params])
  const [state, setState] = useState<PrintState>({ status: 'loading' })
  const rootRef = useRef<HTMLElement>(null)
  const rootPage = state.status === 'ready' ? state.pages[0] : undefined

  useDocumentTitle(rootPage?.title)
  usePrintPreparation(user?.displayName)
  const notReadyInTime = usePrintWhenReady(rootRef, state.status === 'ready')

  useEffect(() => {
    setPrintMode(true)
    return () => setPrintMode(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    resolvePageId(pathSegments)
      .then((pageId) => getSubtreeContent(pageId))
      .then(
        (pages) => !cancelled && setState({ status: 'ready', pages }),
        () => !cancelled && setState({ status: 'error' }),
      )
    return () => {
      cancelled = true
    }
  }, [pathSegments])

  if (state.status !== 'ready' || !rootPage) {
    return (
      <p className="p-8 text-sm text-muted-foreground">
        {state.status === 'error' ? t('printView.error') : t('printView.loading')}
      </p>
    )
  }

  return (
    <main ref={rootRef} className="mx-auto max-w-3xl space-y-8 p-8 print:max-w-none print:p-0">
      {notReadyInTime && (
        <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted px-4 py-3 text-sm print:hidden">
          <span>{t('printView.notReady')}</span>
          <Button size="sm" onClick={() => window.print()}>
            {t('printView.printAnyway')}
          </Button>
        </div>
      )}
      <header className="flex min-h-[60vh] flex-col justify-center gap-2 break-after-page">
        <h1 className="text-4xl font-bold">{rootPage.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t('printView.generatedOn', { date: new Date().toLocaleDateString(i18n.language) })}
        </p>
      </header>

      <nav aria-label={t('printView.contents')} className="break-after-page">
        <h2 className="mb-4 text-2xl font-semibold">{t('printView.contents')}</h2>
        <ul className="space-y-1">
          {state.pages.map((page) => (
            <li key={page.id} style={{ paddingLeft: `${page.depth * 1.25}rem` }}>
              <a href={`#print-page-${page.id}`}>{page.title}</a>
            </li>
          ))}
        </ul>
      </nav>

      {state.pages.map((page) => (
        <section key={page.id} id={`print-page-${page.id}`} className="break-before-page">
          <MarkdownRenderer content={page.content} mode="full" anchorPrefix={`${page.id}-`} />
        </section>
      ))}
    </main>
  )
}
