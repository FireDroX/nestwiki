import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '#components/ui/button'
import { cn } from '#lib/utils'
import type { MergeConflictDetails } from '#api/pages'
import { formatRelativeTime } from '#utils/relative-time'
import { resolveMergeSegments, type ConflictChoice } from '#utils/resolve-merge-segments'

interface ConflictResolverProps {
  conflict: MergeConflictDetails
  onApply: (content: string) => void
  onDiscard: (theirContent: string) => void
}

const CHOICES: { choice: ConflictChoice; labelKey: string }[] = [
  { choice: 'mine', labelKey: 'pageEditor.conflict.keepMine' },
  { choice: 'theirs', labelKey: 'pageEditor.conflict.keepTheirs' },
  { choice: 'both', labelKey: 'pageEditor.conflict.keepBoth' },
]

function Side({ title, lines, emptyLabel }: { title: string; lines: string[]; emptyLabel: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{title}</p>
      <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">
        {lines.length === 0 ? <em>{emptyLabel}</em> : lines.join('\n')}
      </pre>
    </div>
  )
}

export function ConflictResolver({ conflict, onApply, onDiscard }: ConflictResolverProps) {
  const { t } = useTranslation()
  const [choices, setChoices] = useState<Partial<Record<number, ConflictChoice>>>({})
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const author = conflict.currentVersionAuthorName ?? t('pageEditor.conflict.unknownAuthor')
  const total = conflict.segments.filter((segment) => segment.type === 'conflict').length
  const resolved = Object.keys(choices).length
  const recomposed = resolveMergeSegments(conflict.segments, choices)

  const toggleExpanded = (index: number) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t('pageEditor.conflict.title')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('pageEditor.conflict.description', {
            author,
            date: formatRelativeTime(conflict.currentVersionCreatedAt),
          })}
        </p>
        <p className="text-sm font-medium">{t('pageEditor.conflict.progress', { resolved, total })}</p>
      </div>

      {conflict.segments.map((segment, index) => {
        if (segment.type === 'ok') {
          return (
            <div key={index} className="space-y-2">
              <Button variant="ghost" size="sm" onClick={() => toggleExpanded(index)}>
                {t('pageEditor.conflict.identicalLines', { count: segment.lines.length })}
              </Button>
              {expanded.has(index) && (
                <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">
                  {segment.lines.join('\n')}
                </pre>
              )}
            </div>
          )
        }

        return (
          <div key={index} data-testid="merge-conflict" className="space-y-3 rounded-md border p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Side
                title={t('pageEditor.conflict.mine')}
                lines={segment.mine}
                emptyLabel={t('pageEditor.conflict.emptySide')}
              />
              <Side
                title={`${t('pageEditor.conflict.theirs')} (${author})`}
                lines={segment.theirs}
                emptyLabel={t('pageEditor.conflict.emptySide')}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {CHOICES.map(({ choice, labelKey }) => (
                <Button
                  key={choice}
                  size="sm"
                  variant={choices[index] === choice ? 'default' : 'outline'}
                  aria-pressed={choices[index] === choice}
                  className={cn(choices[index] === choice && 'ring-2 ring-ring')}
                  onClick={() => setChoices((current) => ({ ...current, [index]: choice }))}
                >
                  {t(labelKey)}
                </Button>
              ))}
            </div>
          </div>
        )
      })}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onDiscard(conflict.currentVersionContent)}>
          {t('pageEditor.conflict.discard')}
        </Button>
        <Button disabled={recomposed === null} onClick={() => recomposed !== null && onApply(recomposed)}>
          {t('pageEditor.conflict.apply')}
        </Button>
      </div>
    </div>
  )
}
