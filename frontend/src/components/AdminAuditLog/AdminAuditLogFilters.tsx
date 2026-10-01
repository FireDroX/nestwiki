import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#components/ui/select'
import { Input } from '#components/ui/input'
import type { AdminUser } from '#api/users'

const ALL_VALUE = 'all'

export const ADMIN_AUDIT_LOG_ACTIONS = [
  'user.role.update',
  'user.delete',
  'user.create',
  'user.update',
  'user.status.update',
  'user.password.reset',
  'user.unlock',
  'user.groups.update',
  'user.permissions.update',
  'group.create',
  'group.update',
  'group.delete',
  'group.members.update',
  'group.permissions.update',
  'access_rule.create',
  'access_rule.update',
  'access_rule.delete',
  'comment.deleted_by_moderator',
  'comment.purged_by_moderator',
] as const

interface AdminAuditLogFiltersProps {
  admins: AdminUser[]
  adminId: string | undefined
  action: string | undefined
  dateFrom: string | undefined
  dateTo: string | undefined
  search: string | undefined
  onChange: (next: {
    adminId?: string
    action?: string
    dateFrom?: string
    dateTo?: string
    search?: string
  }) => void
}

export function AdminAuditLogFilters({
  admins,
  adminId,
  action,
  dateFrom,
  dateTo,
  search,
  onChange,
}: AdminAuditLogFiltersProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap gap-3">
      <Select
        value={adminId ?? ALL_VALUE}
        onValueChange={(value) => onChange({ adminId: value === ALL_VALUE ? undefined : value })}
      >
        <SelectTrigger className="w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{t('admin.auditLog.allAdmins')}</SelectItem>
          {admins.map((admin) => (
            <SelectItem key={admin.id} value={admin.id}>
              {admin.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={action ?? ALL_VALUE}
        onValueChange={(value) => onChange({ action: value === ALL_VALUE ? undefined : value })}
      >
        <SelectTrigger className="w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{t('admin.auditLog.allActions')}</SelectItem>
          {ADMIN_AUDIT_LOG_ACTIONS.map((value) => (
            <SelectItem key={value} value={value}>
              {t(`admin.auditLog.actions.${value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        className="w-40"
        value={dateFrom ?? ''}
        onChange={(event) => onChange({ dateFrom: event.target.value || undefined })}
      />
      <Input
        type="date"
        className="w-40"
        value={dateTo ?? ''}
        onChange={(event) => onChange({ dateTo: event.target.value || undefined })}
      />
      <Input
        type="text"
        className="w-64"
        placeholder={t('admin.auditLog.searchPlaceholder')}
        value={search ?? ''}
        onChange={(event) => onChange({ search: event.target.value || undefined })}
      />
    </div>
  )
}
