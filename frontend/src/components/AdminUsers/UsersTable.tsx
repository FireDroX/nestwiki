import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Avatar, AvatarFallback, AvatarImage } from '#components/ui/avatar'
import { Badge } from '#components/ui/badge'
import { ResponsiveTable, type ResponsiveColumn } from '#components/ResponsiveTable'
import { DeleteUserDialog } from '#components/AdminUsers/DeleteUserDialog'
import { UserCommentsPanel } from '#components/AdminUsers/UserCommentsPanel'
import { UserRole } from '#api/auth'
import { avatarRawUrl, type AdminUser } from '#api/users'
import { toInitials } from '#utils/initials'
import { intlLocale } from '#utils/relative-time'
import { isUserLocked } from '#utils/user-status'

function formatJoinDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' })
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
  const columns: ResponsiveColumn<AdminUser>[] = [
    {
      id: 'user',
      header: t('admin.users.columnUser'),
      primary: true,
      cell: (user) => (
        <Link to={`/admin/users/${user.id}`} className="flex min-w-0 items-center gap-2.5 hover:underline">
          <Avatar>
            <AvatarImage src={user.hasAvatar ? avatarRawUrl(user.id) : undefined} alt={user.displayName} />
            <AvatarFallback>{toInitials(user.displayName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">{user.displayName}</p>
            <p className="truncate text-sm font-normal text-muted-foreground">{user.email}</p>
          </div>
        </Link>
      ),
    },
    { id: 'role', header: t('admin.users.columnRole'), cell: (user) => roleLabels[user.role] },
    {
      id: 'groups',
      header: t('admin.users.columnGroups'),
      cell: (user) => (
        <div className="flex flex-wrap gap-1">
          {(user.groups ?? []).map((group) => (
            <Badge key={group.id} variant="secondary">
              {group.name}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: 'status',
      header: t('admin.users.columnStatus'),
      cell: (user) =>
        isUserLocked(user) ? (
          <Badge variant="destructive">{t('admin.users.statusLocked')}</Badge>
        ) : user.isActive === false ? (
          <Badge variant="outline">{t('admin.users.statusDisabled')}</Badge>
        ) : (
          <Badge variant="secondary">{t('admin.users.statusActive')}</Badge>
        ),
    },
    {
      id: 'joined',
      header: t('admin.users.columnJoined'),
      className: 'text-muted-foreground',
      cell: (user) => formatJoinDate(user.createdAt),
    },
  ]

  return (
    <ResponsiveTable
      columns={columns}
      rows={users}
      rowKey={(user) => user.id}
      selection={{
        selectedKeys: selectedUserIds,
        onSelectedChange,
        selectAllLabel: t('admin.users.selectAll'),
        selectRowLabel: (user) => t('admin.users.selectUser', { name: user.displayName }),
      }}
      actions={(user) => (
        <>
          <UserCommentsPanel user={user} />
          <DeleteUserDialog
            user={user}
            disabled={user.id === currentUserId}
            pending={pendingUserId === user.id}
            onConfirm={() => onDelete(user)}
          />
        </>
      )}
    />
  )
}
