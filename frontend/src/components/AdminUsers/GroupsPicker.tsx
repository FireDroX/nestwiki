import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
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
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { listGroups, type GroupSummary } from '#api/groups'

interface GroupsPickerProps {
  selectedGroupIds: string[]
  onChange: (groupIds: string[]) => void
  disabled?: boolean
}

export function GroupsPicker({ selectedGroupIds, onChange, disabled = false }: GroupsPickerProps) {
  const { t } = useTranslation()
  const [allGroups, setAllGroups] = useState<GroupSummary[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    listGroups()
      .then(setAllGroups)
      .catch(() => setAllGroups([]))
  }, [])

  const groupById = new Map(allGroups.map((group) => [group.id, group]))
  const selectedGroups = selectedGroupIds
    .map((id) => groupById.get(id))
    .filter((group): group is GroupSummary => !!group)
  const pickableGroups = allGroups.filter((group) => !selectedGroupIds.includes(group.id))

  function handleAdd(groupId: string) {
    setPickerOpen(false)
    onChange([...selectedGroupIds, groupId])
  }

  function handleRemove(groupId: string) {
    onChange(selectedGroupIds.filter((id) => id !== groupId))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {selectedGroups.map((group) => (
          <Badge key={group.id} variant="secondary">
            {group.name}
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(group.id)}
                aria-label={t('admin.users.removeGroupSr', { name: group.name })}
              >
                <X />
              </button>
            )}
          </Badge>
        ))}
        {selectedGroups.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('admin.users.noGroups')}</p>
        )}
      </div>

      {!disabled && (
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setPickerOpen(true)}>
          <Plus /> {t('admin.users.addGroups')}
        </Button>
      )}

      <CommandDialog open={pickerOpen} onOpenChange={setPickerOpen} title={t('admin.users.addGroupsTitle')}>
        <Command>
          <CommandInput placeholder={t('admin.users.searchGroupsPlaceholder')} />
          <CommandList>
            <CommandEmpty>{t('admin.users.noGroupFound')}</CommandEmpty>
            <CommandGroup>
              {pickableGroups.map((group) => (
                <CommandItem key={group.id} value={group.name} onSelect={() => handleAdd(group.id)}>
                  {group.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </div>
  )
}
