import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Info, Lightbulb, MessageSquareWarning, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import { CALLOUT_TYPES, type CalloutType } from '#lib/markdown-callouts'
import { cn } from '#lib/utils'

interface CalloutStyle {
  icon: LucideIcon
  borderClassName: string
  titleClassName: string
}

const CALLOUT_STYLES: Record<CalloutType, CalloutStyle> = {
  note: { icon: Info, borderClassName: 'border-l-blue-500', titleClassName: 'text-blue-600 dark:text-blue-400' },
  tip: { icon: Lightbulb, borderClassName: 'border-l-green-600', titleClassName: 'text-green-700 dark:text-green-400' },
  important: { icon: MessageSquareWarning, borderClassName: 'border-l-violet-500', titleClassName: 'text-violet-600 dark:text-violet-400' },
  warning: { icon: TriangleAlert, borderClassName: 'border-l-amber-500', titleClassName: 'text-amber-700 dark:text-amber-400' },
  caution: { icon: OctagonAlert, borderClassName: 'border-l-red-500', titleClassName: 'text-red-600 dark:text-red-400' },
}

function toCalloutType(value: unknown): CalloutType {
  return CALLOUT_TYPES.find((type) => type === value) ?? 'note'
}

interface MarkdownCalloutProps {
  'data-callout-type'?: string
  'data-callout-title'?: string
  children?: ReactNode
}

export function MarkdownCallout(props: MarkdownCalloutProps) {
  const { t } = useTranslation()
  const type = toCalloutType(props['data-callout-type'])
  const { icon: Icon, borderClassName, titleClassName } = CALLOUT_STYLES[type]
  const title = props['data-callout-title'] || t(`markdown.callout.${type}`)

  return (
    <div
      role="note"
      data-callout={type}
      className={cn('space-y-2 rounded-md border border-l-4 bg-muted/40 px-4 py-3', borderClassName)}
    >
      <p className={cn('flex items-center gap-2 font-semibold', titleClassName)}>
        <Icon className="size-4 shrink-0" aria-hidden />
        {title}
      </p>
      {props.children}
    </div>
  )
}
