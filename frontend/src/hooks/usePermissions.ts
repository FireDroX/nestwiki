import type { GlobalPermission, PageAction } from '#api/permissions'
import { useAuth } from '#hooks/useAuth'

interface PageWithPermissions {
  permissions: PageAction[]
}

export interface UsePermissionsResult {
  hasGlobal: (permission: GlobalPermission) => boolean
  canOnPage: (page: PageWithPermissions | null | undefined, action: PageAction) => boolean
}

export function usePermissions(): UsePermissionsResult {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  function hasGlobal(permission: GlobalPermission): boolean {
    if (isAdmin) {
      return true
    }
    return !!user?.permissions?.includes(permission)
  }

  function canOnPage(page: PageWithPermissions | null | undefined, action: PageAction): boolean {
    if (isAdmin) {
      return true
    }
    return !!page?.permissions.includes(action)
  }

  return { hasGlobal, canOnPage }
}
