import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#components/ui/command'
import { Button } from '#components/ui/button'
import { listUsers, type AdminUser } from '#api/users'
import type { GroupMember } from '#api/groups'
import { extractErrorMessage } from '#lib/api-errors'

const SEARCH_DEBOUNCE_MS = 300
const SEARCH_LIMIT = 20

interface MembersTabProps {
  members: GroupMember[]
  pending: boolean
  onChange: (userIds: string[]) => Promise<void>
}

export function MembersTab({ members, pending, onChange }: MembersTabProps) {
  const { t } = useTranslation()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AdminUser[]>([])

  useEffect(() => {
    if (!pickerOpen) {
      setQuery('')
      setResults([])
    }
  }, [pickerOpen])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      return
    }
    let cancelled = false
    const timeout = setTimeout(() => {
      listUsers({ limit: SEARCH_LIMIT, search: trimmed })
        .then((page) => {
          if (!cancelled) setResults(page.items)
        })
        .catch(() => {
          if (!cancelled) setResults([])
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [query])

  const memberIds = new Set(members.map((member) => member.id))
  const pickableResults = results.filter((user) => !memberIds.has(user.id))

  async function handleAdd(userId: string) {
    setPickerOpen(false)
    try {
      await onChange([...memberIds, userId])
      toast.success(t('admin.groups.memberAdded'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('admin.groups.memberAddFailed')))
    }
  }

  async function handleRemove(userId: string) {
    try {
      await onChange(members.map((member) => member.id).filter((id) => id !== userId))
      toast.success(t('admin.groups.memberRemoved'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('admin.groups.memberRemoveFailed')))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setPickerOpen(true)}>
        <Plus /> {t('admin.groups.addMembers')}
      </Button>

      {members.length === 0 && <p className="text-sm text-muted-foreground">{t('admin.groups.noMembers')}</p>}

      <ul className="flex flex-col gap-1.5">
        {members.map((member) => (
          <li key={member.id} className="flex items-center justify-between rounded-md border px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{member.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{member.email}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={pending}
              onClick={() => handleRemove(member.id)}
              aria-label={t('admin.groups.removeMemberSr', { name: member.displayName })}
            >
              <X />
            </Button>
          </li>
        ))}
      </ul>

      <CommandDialog open={pickerOpen} onOpenChange={setPickerOpen} title={t('admin.groups.addMembersTitle')}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('admin.groups.searchUsersPlaceholder')}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>{t('admin.groups.noUserFound')}</CommandEmpty>
            <CommandGroup>
              {pickableResults.map((user) => (
                <CommandItem key={user.id} value={user.id} onSelect={() => handleAdd(user.id)}>
                  <div className="min-w-0">
                    <p className="truncate">{user.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </div>
  )
}
