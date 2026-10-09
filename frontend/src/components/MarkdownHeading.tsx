import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { Link2 } from 'lucide-react'
import { cn } from '#lib/utils'

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

function HeadingAnchor({ id }: { id: string }) {
  const { t } = useTranslation()
  return (
    <a
      href={`#${id}`}
      aria-label={t('markdown.headingLink')}
      className="ml-2 inline-flex align-middle opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
    >
      <Link2 className="size-4" aria-hidden />
    </a>
  )
}

type MarkdownHeadingProps = ComponentProps<'h1'> & { level: HeadingLevel; node?: unknown }

export function MarkdownHeading({ level, id, className, children, node: _node, ...rest }: MarkdownHeadingProps) {
  const Tag = `h${level}` as const
  if (!id) {
    return <Tag className={className} {...rest}>{children}</Tag>
  }
  return (
    <Tag id={id} className={cn('group scroll-mt-4', className)} {...rest}>
      {children}
      <HeadingAnchor id={id} />
    </Tag>
  )
}
