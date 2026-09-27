import { Navigate, Outlet } from 'react-router'
import type { UserRole } from '#api/auth'
import type { GlobalPermission } from '#api/permissions'
import { useAuth } from '#hooks/useAuth'
import { usePermissions } from '#hooks/usePermissions'

interface ProtectedRouteProps {
  roles?: UserRole[]
  permission?: GlobalPermission
}

export function ProtectedRoute({ roles, permission }: ProtectedRouteProps) {
  const { status, user } = useAuth()
  const { hasGlobal } = usePermissions()

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace />
  }

  if (roles && (!user || !roles.includes(user.role))) {
    return <Navigate to="/" replace />
  }

  if (permission && !hasGlobal(permission)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
