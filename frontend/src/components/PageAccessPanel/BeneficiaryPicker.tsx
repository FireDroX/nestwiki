import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#components/ui/command'
import { Avatar, AvatarFallback, AvatarImage } from '#components/ui/avatar'
import { listUsers, type AdminUser } from '#api/users'
import { listGroups, type GroupSummary } from '#api/groups'
import { toInitials } from '#utils/initials'

export interface Beneficiary {
  type: 'user' | 'group'
  id: string
  name: string
}

const SEARCH_DEBOUNCE_MS = 300
const SEARCH_LIMIT = 20

interface BeneficiaryPickerProps {
  onSelect: (beneficiary: Beneficiary) => void
}

export function BeneficiaryPicker({ onSelect }: BeneficiaryPickerProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [allGroups, setAllGroups] = useState<GroupSummary[]>([])

  useEffect(() => {
    listGroups()
      .then(setAllGroups)
      .catch(() => setAllGroups([]))
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setUsers([])
      return
    }
    let cancelled = false
    const timeout = setTimeout(() => {
      listUsers({ limit: SEARCH_LIMIT, search: trimmed })
        .then((page) => {
          if (!cancelled) setUsers(page.items)
        })
        .catch(() => {
          if (!cancelled) setUsers([])
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [query])

  const matchingGroups = allGroups.filter((group) =>
    group.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <Command shouldFilter={false}>
      <CommandInput
        placeholder={t('pageAccessPanel.searchBeneficiaryPlaceholder')}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{t('pageAccessPanel.noBeneficiaryFound')}</CommandEmpty>
        {matchingGroups.length > 0 && (
          <CommandGroup heading={t('pageAccessPanel.groupsHeading')}>
            {matchingGroups.map((group) => (
              <CommandItem
                key={group.id}
                value={`group-${group.id}`}
                onSelect={() => onSelect({ type: 'group', id: group.id, name: group.name })}
              >
                <Users className="size-4 shrink-0 text-muted-foreground" />
                {group.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {users.length > 0 && (
          <CommandGroup heading={t('pageAccessPanel.usersHeading')}>
            {users.map((user) => (
              <CommandItem
                key={user.id}
                value={`user-${user.id}`}
                onSelect={() => onSelect({ type: 'user', id: user.id, name: user.displayName })}
              >
                <Avatar className="size-5">
                  <AvatarImage src={user.avatarUrl ?? undefined} alt={user.displayName} />
                  <AvatarFallback className="text-[10px]">{toInitials(user.displayName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate">{user.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  )
}
