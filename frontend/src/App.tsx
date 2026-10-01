import { Route, Routes } from 'react-router'
import { AppLayout } from '#components/layout/AppLayout'
import { AppLayoutSkeleton } from '#components/layout/AppLayoutSkeleton'
import { GlobalSearchCommand } from '#components/GlobalSearchCommand'
import { ProtectedRoute } from '#components/ProtectedRoute'
import { UserRole } from '#api/auth'
import { useAuth } from '#hooks/useAuth'
import { AdminActivityLog } from '#pages/AdminActivityLog'
import { AdminAuditLog } from '#pages/AdminAuditLog'
import { AdminGroupDetail } from '#pages/AdminGroupDetail'
import { AdminGroups } from '#pages/AdminGroups'
import { AdminMcpAudit } from '#pages/AdminMcpAudit'
import { AdminMcpKeys } from '#pages/AdminMcpKeys'
import { AdminOAuthClients } from '#pages/AdminOAuthClients'
import { AdminSettings } from '#pages/AdminSettings'
import { AdminUsers } from '#pages/AdminUsers'
import { Home } from '#pages/Home'
import { Login } from '#pages/Login'
import { OAuthConsent } from '#pages/OAuthConsent'
import { PageCreate } from '#pages/PageCreate'
import { PageEditor } from '#pages/PageEditor'
import { PageHistory } from '#pages/PageHistory'
import { PageView } from '#pages/PageView'
import { Profile } from '#pages/Profile'
import { SearchResults } from '#pages/SearchResults'

export function App() {
  const { status } = useAuth()

  if (status === 'loading') {
    return <AppLayoutSkeleton />
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/oauth/consent" element={<OAuthConsent />} />
        </Route>
        <Route element={<ProtectedRoute permission="page.create_root" />}>
          <Route path="/new" element={<PageCreate />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/edit/*" element={<PageEditor />} />
        </Route>
        <Route element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="/pages/*" element={<PageView />} />
          <Route path="/history/*" element={<PageHistory />} />
          <Route path="/search" element={<SearchResults />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route element={<ProtectedRoute roles={[UserRole.Admin]} />}>
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/mcp/api-keys" element={<AdminMcpKeys />} />
            <Route path="/admin/mcp/oauth-clients" element={<AdminOAuthClients />} />
            <Route path="/admin/mcp/audit-log" element={<AdminMcpAudit />} />
            <Route path="/admin/audit-log" element={<AdminAuditLog />} />
            <Route path="/admin/activity-log" element={<AdminActivityLog />} />
          </Route>
          <Route element={<ProtectedRoute permission="user.manage" />}>
            <Route path="/admin/groups" element={<AdminGroups />} />
            <Route path="/admin/groups/:id" element={<AdminGroupDetail />} />
          </Route>
        </Route>
      </Routes>
      <GlobalSearchCommand />
    </>
  )
}
