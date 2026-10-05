import { useTranslation } from 'react-i18next'
import { Badge } from '#components/ui/badge'
import { UserRole, type AuthUser } from '#api/auth'
import { formatDate } from '#utils/relative-time'

interface ProfileSummaryProps {
  user: AuthUser
}

export function ProfileSummary({ user }: ProfileSummaryProps) {
  const { t } = useTranslation()

  const roleLabels: Record<UserRole, string> = {
    [UserRole.Admin]: t('admin.users.roleAdmin'),
    [UserRole.Member]: t('admin.users.roleMember'),
  }

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-1.5 text-center sm:w-auto sm:items-start sm:text-left">
      <h2 className="max-w-full truncate font-heading text-xl font-semibold">{user.displayName}</h2>
      <p className="max-w-full truncate text-sm text-muted-foreground">{user.email}</p>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1 sm:justify-start">
        <Badge variant="secondary">{roleLabels[user.role]}</Badge>
        {user.groups?.map((group) => (
          <Badge key={group.id} variant="outline">
            {group.name}
          </Badge>
        ))}
        <span className="text-xs text-muted-foreground">
          {t('profile.memberSince', { date: formatDate(user.createdAt) })}
        </span>
      </div>
    </div>
  )
}
