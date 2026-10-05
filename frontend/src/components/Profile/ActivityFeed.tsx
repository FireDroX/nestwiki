import { useTranslation } from 'react-i18next'
import { Button } from '#components/ui/button'
import type { UserActivityLogItem } from '#api/user-activity-log'
import { useMyActivity } from '#hooks/useMyActivity'
import { formatRelativeTime } from '#utils/relative-time'

function metadataTitle(metadata: unknown): string | null {
  if (metadata && typeof metadata === 'object' && 'title' in metadata) {
    const { title } = metadata as { title: unknown }
    return typeof title === 'string' ? title : null
  }
  return null
}

interface ActivityItemProps {
  item: UserActivityLogItem
  actionLabels: Record<string, string>
  actionCategories: Record<string, string>
  categoryLabels: Record<string, string>
}

function ActivityItem({ item, actionLabels, actionCategories, categoryLabels }: ActivityItemProps) {
  const category = actionCategories[item.action] ?? 'edit'
  const categoryLabel = categoryLabels[category] ?? category
  const content = metadataTitle(item.metadata) ?? actionLabels[item.action] ?? item.action

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0 sm:flex-nowrap">
      <span className="shrink-0 text-xs font-semibold tracking-wide text-primary uppercase sm:w-28">
        {categoryLabel}
      </span>
      <span className="order-last min-w-0 basis-full truncate sm:order-none sm:flex-1 sm:basis-auto">{content}</span>
      <span className="ml-auto shrink-0 text-xs text-muted-foreground sm:ml-0">{formatRelativeTime(item.createdAt)}</span>
    </li>
  )
}

export function ActivityFeed() {
  const { t } = useTranslation()
  const { items, total, page, limit, status, goToPage } = useMyActivity()
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const actionLabels = t('profile.activityActions', { returnObjects: true }) as Record<string, string>
  const actionCategories = t('profile.activityActionCategories', { returnObjects: true }) as Record<
    string,
    string
  >
  const categoryLabels = t('profile.activityCategories', { returnObjects: true }) as Record<string, string>

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
      {status === 'loading' && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
      {status === 'error' && (
        <p className="text-sm text-destructive">{t('profile.activityLoadError')}</p>
      )}
      {status === 'ready' && items.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('profile.activityEmpty')}</p>
      )}

      {status === 'ready' && items.length > 0 && (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <ActivityItem
              key={item.id}
              item={item}
              actionLabels={actionLabels}
              actionCategories={actionCategories}
              categoryLabels={categoryLabels}
            />
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
            {t('common.previous')}
          </Button>
          <span className="text-sm text-muted-foreground">{t('common.pageOf', { page, total: totalPages })}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            {t('common.next')}
          </Button>
        </div>
      )}
    </div>
  )
}
