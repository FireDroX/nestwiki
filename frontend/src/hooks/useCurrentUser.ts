import type { AuthUserGroup, UserRole } from '#api/auth'
import type { GlobalPermission } from '#api/permissions'
import { useAuth } from '#hooks/useAuth'
import { toInitials } from '#utils/initials'

export interface CurrentUser {
  displayName: string
  initials: string
  role: UserRole
  avatarUrl: string | null
  permissions: GlobalPermission[]
  groups: AuthUserGroup[]
}

export function useCurrentUser(): CurrentUser | null {
  const { user } = useAuth()
  if (!user) {
    return null
  }
  return {
    displayName: user.displayName,
    initials: toInitials(user.displayName),
    role: user.role,
    avatarUrl: user.avatarUrl,
    permissions: user.permissions ?? [],
    groups: user.groups ?? [],
  }
}
