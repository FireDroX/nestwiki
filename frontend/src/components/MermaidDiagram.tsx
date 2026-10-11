import { type ReactNode, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from 'next-themes'
import { usePrintMode } from '#lib/print-mode'

type MermaidRender =
  | { status: 'loading' }
  | { status: 'rendered'; svg: string; dark: boolean }
  | { status: 'error'; message: string }

function toPlainText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map(toPlainText).join('')
  }
  return ''
}

async function renderMermaid(elementId: string, code: string, dark: boolean): Promise<string> {
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    theme: dark ? 'dark' : 'default',
  })
  const { svg } = await mermaid.render(elementId, code)
  return svg
}

function MermaidSource({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm">
      <code>{code}</code>
    </pre>
  )
}

export function MermaidDiagram({ children }: { children?: ReactNode }) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const printMode = usePrintMode()
  const dark = resolvedTheme === 'dark' && !printMode
  const elementId = `mermaid-${useId().replace(/[^\w-]/g, '')}`
  const code = toPlainText(children)
  const [result, setResult] = useState<MermaidRender>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    renderMermaid(elementId, code, dark).then(
      (svg) => {
        if (!cancelled) setResult({ status: 'rendered', svg, dark })
      },
      (error: unknown) => {
        if (!cancelled) setResult({ status: 'error', message: error instanceof Error ? error.message : String(error) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [elementId, code, dark])

  if (result.status === 'rendered') {
    return (
      <div
        data-slot="mermaid-diagram"
        data-print-pending={result.dark !== dark ? '' : undefined}
        className="flex justify-center overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: result.svg }}
      />
    )
  }

  if (result.status === 'error') {
    return (
      <div data-slot="mermaid-error" className="space-y-2">
        <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {t('markdown.mermaidError')} {result.message}
        </p>
        <MermaidSource code={code} />
      </div>
    )
  }

  return (
    <div data-print-pending>
      <MermaidSource code={code} />
    </div>
  )
}
