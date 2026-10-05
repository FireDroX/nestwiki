import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#components/ui/select'
import { Input } from '#components/ui/input'
import type { AdminUser } from '#api/users'

const ALL_VALUE = 'all'

export const USER_ACTIVITY_LOG_ACTIONS = [
  'auth.login',
  'page.created',
  'page.updated',
  'page.moved',
  'page.deleted',
  'page.restored',
  'media.uploaded',
  'media.deleted',
] as const

interface AdminActivityLogFiltersProps {
  users: AdminUser[]
  userId: string | undefined
  action: string | undefined
  dateFrom: string | undefined
  dateTo: string | undefined
  search: string | undefined
  onChange: (next: {
    userId?: string
    action?: string
    dateFrom?: string
    dateTo?: string
    search?: string
  }) => void
}

export function AdminActivityLogFilters({
  users,
  userId,
  action,
  dateFrom,
  dateTo,
  search,
  onChange,
}: AdminActivityLogFiltersProps) {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
      <Select
        value={userId ?? ALL_VALUE}
        onValueChange={(value) => onChange({ userId: value === ALL_VALUE ? undefined : value })}
      >
        <SelectTrigger className="w-full lg:w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{t('admin.activityLog.allUsers')}</SelectItem>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={action ?? ALL_VALUE}
        onValueChange={(value) => onChange({ action: value === ALL_VALUE ? undefined : value })}
      >
        <SelectTrigger className="w-full lg:w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{t('admin.activityLog.allActions')}</SelectItem>
          {USER_ACTIVITY_LOG_ACTIONS.map((value) => (
            <SelectItem key={value} value={value}>
              {t(`admin.activityLog.actions.${value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        className="w-full lg:w-40"
        value={dateFrom ?? ''}
        onChange={(event) => onChange({ dateFrom: event.target.value || undefined })}
      />
      <Input
        type="date"
        className="w-full lg:w-40"
        value={dateTo ?? ''}
        onChange={(event) => onChange({ dateTo: event.target.value || undefined })}
      />
      <Input
        type="text"
        className="w-full lg:w-64"
        placeholder={t('admin.activityLog.searchPlaceholder')}
        value={search ?? ''}
        onChange={(event) => onChange({ search: event.target.value || undefined })}
      />
    </div>
  )
}
