import { type ComponentProps, type ReactNode, useEffect, useId, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'
import { ApiReferenceViewer } from '#components/ApiReferenceViewer'
import { MarkdownCallout } from '#components/MarkdownCallout'
import { MarkdownHeading } from '#components/MarkdownHeading'
import { PdfPreview } from '#components/PdfPreview'
import { CALLOUT_TAG_NAME, rehypeCallouts } from '#lib/markdown-callouts'
import { rehypeHeadingIds } from '#lib/markdown-headings'
import { rehypeHardenFullMode } from '#lib/markdown-sanitize'
import { rehypeScopeStyles } from '#lib/markdown-css-scope'
import { cn } from '#lib/utils'

function isPdfUrl(href: string): boolean {
  const withoutQuery = href.split(/[?#]/)[0]
  return withoutQuery.toLowerCase().endsWith('.pdf')
}

function toPlainText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map(toPlainText).join('')
  }
  return ''
}

const MARKDOWN_SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'api-reference'],
}

const SHIKI_THEME = 'github-dark'

interface CodeBlockProps {
  language: string
  code: string
}

function CodeBlock({ language, code }: CodeBlockProps) {
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

  if (!html) {
    return (
      <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm">
        <code>{code}</code>
      </pre>
    )
  }

  return (
    <div
      className="[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:p-4 [&_pre]:text-sm"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

interface MarkdownRendererProps {
  content: string
  mode?: 'full' | 'restricted'
}

const MARKDOWN_BODY_CLASSES = cn(
  'max-w-none space-y-4 text-sm leading-relaxed break-words',
  '[&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:mt-6',
  '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-6',
  '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4',
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground',
  '[&_hr]:border-border',
  '[&_img]:max-w-full [&_img]:rounded-md',
  '[&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:p-2 [&_td]:border [&_td]:border-border [&_td]:p-2',
  '[&_details]:mt-2 [&_details]:rounded-md [&_details]:border [&_details]:border-border [&_details]:p-3',
  '[&_summary]:cursor-pointer [&_summary]:select-none [&_summary]:font-medium',
  '[&_details[open]_summary]:mb-3',
)

const markdownComponents = {
  pre({ children }: { children?: ReactNode }) {
    return <>{children}</>
  },
  'api-reference': () => <ApiReferenceViewer />,
  [CALLOUT_TAG_NAME]: MarkdownCallout,
  h1: (props: ComponentProps<'h1'>) => <MarkdownHeading level={1} {...props} />,
  h2: (props: ComponentProps<'h2'>) => <MarkdownHeading level={2} {...props} />,
  h3: (props: ComponentProps<'h3'>) => <MarkdownHeading level={3} {...props} />,
  h4: (props: ComponentProps<'h4'>) => <MarkdownHeading level={4} {...props} />,
  h5: (props: ComponentProps<'h5'>) => <MarkdownHeading level={5} {...props} />,
  h6: (props: ComponentProps<'h6'>) => <MarkdownHeading level={6} {...props} />,
  a({ href, children, node: _node, ...rest }: ComponentProps<'a'> & { node?: unknown }) {
    if (href && isPdfUrl(href)) {
      const filename = toPlainText(children) || href.split('/').pop() || href
      return (
        <PdfPreview url={href} filename={filename} interactive className="my-2 h-[28rem] max-w-2xl" />
      )
    }
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    )
  },
  code({ className, children, node: _node, ...rest }: ComponentProps<'code'> & { node?: unknown }) {
    const match = /language-(\w+)/.exec(className ?? '')
    if (match) {
      return <CodeBlock language={match[1]} code={String(children).replace(/\n$/, '')} />
    }
    return (
      <code className={cn('rounded bg-muted px-1 py-0.5 text-sm [overflow-wrap:anywhere]', className)} {...rest}>
        {children}
      </code>
    )
  },
}

export function MarkdownRenderer({ content, mode = 'restricted' }: MarkdownRendererProps) {
  const scopeId = useId()
  const remarkPlugins: Array<unknown> =
    mode === 'full' ? [remarkGfm, [remarkMath, { singleDollarTextMath: false }]] : [remarkGfm]
  const rehypePlugins: Array<unknown> =
    mode === 'full'
      ? [rehypeRaw, rehypeHardenFullMode, [rehypeScopeStyles, scopeId], rehypeHeadingIds, rehypeKatex, rehypeCallouts]
      : [rehypeRaw, [rehypeSanitize, MARKDOWN_SANITIZE_SCHEMA], rehypeCallouts]

  return (
    <div id={mode === 'full' ? scopeId : undefined} className={MARKDOWN_BODY_CLASSES}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins as Parameters<typeof ReactMarkdown>[0]['remarkPlugins']}
        rehypePlugins={rehypePlugins as Parameters<typeof ReactMarkdown>[0]['rehypePlugins']}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
