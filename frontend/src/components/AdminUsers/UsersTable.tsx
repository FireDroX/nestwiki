import { useTranslation } from 'react-i18next'
import { Avatar, AvatarFallback, AvatarImage } from '#components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#components/ui/select'
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

interface UsersTableProps {
  users: AdminUser[]
  currentUserId: string | undefined
  pendingUserId: string | null
  onRoleChange: (user: AdminUser, role: UserRole) => void
  onDelete: (user: AdminUser) => void
}

export function UsersTable({ users, currentUserId, pendingUserId, onRoleChange, onDelete }: UsersTableProps) {
  const { t } = useTranslation()
  const roleLabels: Record<UserRole, string> = {
    [UserRole.Admin]: t('admin.users.roleAdmin'),
    [UserRole.Member]: t('admin.users.roleMember'),
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.users.columnUser')}</TableHead>
          <TableHead>{t('admin.users.columnRole')}</TableHead>
          <TableHead>{t('admin.users.columnJoined')}</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const isSelf = user.id === currentUserId
          const isPending = pendingUserId === user.id
          return (
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <Avatar>
                    <AvatarImage src={user.avatarUrl ?? undefined} alt={user.displayName} />
                    <AvatarFallback>{toInitials(user.displayName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{user.displayName}</p>
                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Select
                  value={user.role}
                  onValueChange={(role) => onRoleChange(user, role as UserRole)}
                  disabled={isSelf || isPending}
                >
                  <SelectTrigger
                    size="sm"
                    title={isSelf ? t('admin.users.selfRoleTooltip') : undefined}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(UserRole).map((role) => (
                      <SelectItem key={role} value={role}>
                        {roleLabels[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
