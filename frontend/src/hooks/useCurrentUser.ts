import type { AuthUserGroup, UserRole } from '#api/auth'
import type { GlobalPermission } from '#api/permissions'
import { useAuth } from '#hooks/useAuth'
import { toInitials } from '#utils/initials'

export interface CurrentUser {
  id: string
  displayName: string
  initials: string
  role: UserRole
  hasAvatar: boolean
  permissions: GlobalPermission[]
  groups: AuthUserGroup[]
}

export function useCurrentUser(): CurrentUser | null {
  const { user } = useAuth()
  if (!user) {
    return null
  }
  return {
    id: user.id,
    displayName: user.displayName,
    initials: toInitials(user.displayName),
    role: user.role,
    hasAvatar: user.hasAvatar,
    permissions: user.permissions ?? [],
    groups: user.groups ?? [],
  }
}
