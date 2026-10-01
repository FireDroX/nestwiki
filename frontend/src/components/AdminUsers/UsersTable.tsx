import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Avatar, AvatarFallback, AvatarImage } from '#components/ui/avatar'
import { Badge } from '#components/ui/badge'
import { Checkbox } from '#components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#components/ui/table'
import { DeleteUserDialog } from '#components/AdminUsers/DeleteUserDialog'
import { UserCommentsPanel } from '#components/AdminUsers/UserCommentsPanel'
import { UserRole } from '#api/auth'
import type { AdminUser } from '#api/users'
import { toInitials } from '#utils/initials'
import { intlLocale } from '#utils/relative-time'

function formatJoinDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' })
}

function isLocked(user: AdminUser): boolean {
  return !!user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()
}

interface UsersTableProps {
  users: AdminUser[]
  currentUserId: string | undefined
  pendingUserId: string | null
  selectedUserIds: string[]
  onSelectedChange: (userIds: string[]) => void
  onDelete: (user: AdminUser) => void
}

export function UsersTable({
  users,
  currentUserId,
  pendingUserId,
  selectedUserIds,
  onSelectedChange,
  onDelete,
}: UsersTableProps) {
  const { t } = useTranslation()
  const roleLabels: Record<UserRole, string> = {
    [UserRole.Admin]: t('admin.users.roleAdmin'),
    [UserRole.Member]: t('admin.users.roleMember'),
  }
  const selectedSet = new Set(selectedUserIds)
  const allSelected = users.length > 0 && users.every((user) => selectedSet.has(user.id))

  function toggleAll(checked: boolean) {
    onSelectedChange(checked ? users.map((user) => user.id) : [])
  }

  function toggleOne(userId: string, checked: boolean) {
    onSelectedChange(checked ? [...selectedUserIds, userId] : selectedUserIds.filter((id) => id !== userId))
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox checked={allSelected} onCheckedChange={(checked) => toggleAll(checked === true)} />
          </TableHead>
          <TableHead>{t('admin.users.columnUser')}</TableHead>
          <TableHead>{t('admin.users.columnRole')}</TableHead>
          <TableHead>{t('admin.users.columnGroups')}</TableHead>
          <TableHead>{t('admin.users.columnStatus')}</TableHead>
          <TableHead>{t('admin.users.columnJoined')}</TableHead>
          <TableHead className="w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const isSelf = user.id === currentUserId
          const isPending = pendingUserId === user.id
          const locked = isLocked(user)
          return (
            <TableRow key={user.id}>
              <TableCell>
                <Checkbox
                  checked={selectedSet.has(user.id)}
                  onCheckedChange={(checked) => toggleOne(user.id, checked === true)}
                />
              </TableCell>
              <TableCell>
                <Link to={`/admin/users/${user.id}`} className="flex items-center gap-2.5 hover:underline">
                  <Avatar>
                    <AvatarImage src={user.avatarUrl ?? undefined} alt={user.displayName} />
                    <AvatarFallback>{toInitials(user.displayName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{user.displayName}</p>
                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </Link>
              </TableCell>
              <TableCell>{roleLabels[user.role]}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {(user.groups ?? []).map((group) => (
                    <Badge key={group.id} variant="secondary">
                      {group.name}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                {locked ? (
                  <Badge variant="destructive">{t('admin.users.statusLocked')}</Badge>
                ) : user.isActive === false ? (
                  <Badge variant="outline">{t('admin.users.statusDisabled')}</Badge>
                ) : (
                  <Badge variant="secondary">{t('admin.users.statusActive')}</Badge>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{formatJoinDate(user.createdAt)}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <UserCommentsPanel user={user} />
                  <DeleteUserDialog user={user} disabled={isSelf} pending={isPending} onConfirm={() => onDelete(user)} />
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
