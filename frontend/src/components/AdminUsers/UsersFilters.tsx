import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { InputGroup, InputGroupAddon, InputGroupInput } from '#components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#components/ui/select'
import type { GroupSummary } from '#api/groups'
import { UserRole } from '#api/auth'

const ALL_VALUE = 'all'

export interface UsersFiltersValue {
  search: string
  role: UserRole | undefined
  groupId: string | undefined
  active: boolean | undefined
}

interface UsersFiltersProps {
  value: UsersFiltersValue
  groups: GroupSummary[]
  onChange: (value: UsersFiltersValue) => void
}

export function UsersFilters({ value, groups, onChange }: UsersFiltersProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap items-center gap-3">
      <InputGroup className="max-w-[280px]">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          placeholder={t('admin.users.filterPlaceholder')}
          value={value.search}
          onChange={(event) => onChange({ ...value, search: event.target.value })}
        />
      </InputGroup>

      <Select
        value={value.role ?? ALL_VALUE}
        onValueChange={(role) => onChange({ ...value, role: role === ALL_VALUE ? undefined : (role as UserRole) })}
      >
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{t('admin.users.filterAllRoles')}</SelectItem>
          <SelectItem value={UserRole.Admin}>{t('admin.users.roleAdmin')}</SelectItem>
          <SelectItem value={UserRole.Member}>{t('admin.users.roleMember')}</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={value.groupId ?? ALL_VALUE}
        onValueChange={(groupId) => onChange({ ...value, groupId: groupId === ALL_VALUE ? undefined : groupId })}
      >
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{t('admin.users.filterAllGroups')}</SelectItem>
          {groups.map((group) => (
            <SelectItem key={group.id} value={group.id}>
              {group.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.active === undefined ? ALL_VALUE : String(value.active)}
        onValueChange={(active) => onChange({ ...value, active: active === ALL_VALUE ? undefined : active === 'true' })}
      >
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{t('admin.users.filterAllStatuses')}</SelectItem>
          <SelectItem value="true">{t('admin.users.statusActive')}</SelectItem>
          <SelectItem value="false">{t('admin.users.statusDisabled')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
