import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { getPageByPath, getSubtreeContent, type SubtreePage } from '#api/pages'
import { MarkdownRenderer } from '#components/MarkdownRenderer'
import { useAuth } from '#hooks/useAuth'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { usePrintPreparation } from '#hooks/usePrintPreparation'
import { isPrintableContentReady } from '#utils/printable-content'

const READY_CHECK_INTERVAL_MS = 200
const READY_TIMEOUT_MS = 15000

type PrintState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; pages: SubtreePage[] }

function usePrintWhenReady(rootRef: React.RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return
    }
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      const root = rootRef.current
      const timedOut = Date.now() - startedAt > READY_TIMEOUT_MS
      if (root && (isPrintableContentReady(root) || timedOut)) {
        window.clearInterval(timer)
        window.print()
      }
    }, READY_CHECK_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [rootRef, enabled])
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
  usePrintWhenReady(rootRef, state.status === 'ready')

  useEffect(() => {
    let cancelled = false
    getPageByPath(pathSegments)
      .then((page) => getSubtreeContent(page.id))
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
          <MarkdownRenderer content={page.content} mode="full" />
        </section>
      ))}
    </main>
  )
}
