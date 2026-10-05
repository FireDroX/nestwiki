import { useTranslation } from 'react-i18next'
import type { AuthUser } from '#api/auth'

interface ProfileStatsProps {
  user: AuthUser
}

export function ProfileStats({ user }: ProfileStatsProps) {
  const { t } = useTranslation()

  const stats = [
    { value: user.pagesCreatedCount ?? 0, label: t('profile.stats.pagesCreated') },
    { value: user.pageEditsCount ?? 0, label: t('profile.stats.modifications') },
    { value: user.commentsCount ?? 0, label: t('profile.stats.comments') },
  ]

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-0 rounded-lg border border-border bg-card p-3 sm:p-4">
          <div className="font-heading text-2xl font-bold">{stat.value}</div>
          <div className="text-xs break-words text-muted-foreground sm:text-sm">{stat.label}</div>
        </div>
      ))}
    </div>
  )
}
