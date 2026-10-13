import { useEffect, useState } from 'react'
import { cn } from '#lib/utils'

const SHIKI_THEME = 'github-dark'

interface CodeBlockProps {
  language: string
  code: string
  className?: string
}

export function CodeBlock({ language, code, className }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    import('shiki').then(({ codeToHtml }) =>
      codeToHtml(code, { lang: language, theme: SHIKI_THEME }).catch(() =>
        codeToHtml(code, { lang: 'text', theme: SHIKI_THEME }),
      ),
    ).then((result) => {
      if (!cancelled) setHtml(result)
    })

    return () => {
      cancelled = true
    }
  }, [code, language])

  const containerClassName = cn('[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:p-4 [&_pre]:text-sm', className)

  if (!html) {
    return (
      <div className={containerClassName}>
        <pre className="bg-muted">
          <code>{code}</code>
        </pre>
      </div>
    )
  }

  return <div className={containerClassName} dangerouslySetInnerHTML={{ __html: html }} />
}
