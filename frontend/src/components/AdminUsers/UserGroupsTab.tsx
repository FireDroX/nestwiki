import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { GroupsPicker } from '#components/AdminUsers/GroupsPicker'
import { setUserGroups, type AdminUserDetail } from '#api/users'
import { listGroups, type GroupSummary } from '#api/groups'
import { extractErrorMessage } from '#lib/api-errors'

interface UserGroupsTabProps {
  user: AdminUserDetail
  onUpdated: (user: AdminUserDetail) => void
}

export function UserGroupsTab({ user, onUpdated }: UserGroupsTabProps) {
  const { t } = useTranslation()
  const [allGroups, setAllGroups] = useState<GroupSummary[]>([])
  const [pending, setPending] = useState(false)

  useEffect(() => {
    listGroups()
      .then(setAllGroups)
      .catch(() => setAllGroups([]))
  }, [])

  async function handleChange(groupIds: string[]) {
    setPending(true)
    try {
      const updated = await setUserGroups(user.id, groupIds)
      onUpdated(updated)
      toast.success(t('admin.users.groupsUpdated'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('admin.users.groupsUpdateFailed')))
    } finally {
      setPending(false)
    }
  }

  const groupById = new Map(allGroups.map((group) => [group.id, group]))

  return (
    <div className="flex flex-col gap-4">
      <GroupsPicker selectedGroupIds={user.groups.map((group) => group.id)} onChange={handleChange} disabled={pending} />

      {user.groups.length > 0 && (
        <ul className="flex flex-col gap-1">
          {user.groups.map((group) => (
            <li key={group.id}>
              <Link to={`/admin/groups/${group.id}`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
                {groupById.get(group.id)?.name ?? group.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
