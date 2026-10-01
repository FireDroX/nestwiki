import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '#lib/utils'

export function AdminNav() {
  const { t } = useTranslation()
  const links = [
    { to: '/admin/users', label: t('admin.usersTab') },
    { to: '/admin/groups', label: t('admin.groupsTab') },
    { to: '/admin/settings', label: t('admin.settingsTab') },
    { to: '/admin/mcp/api-keys', label: t('admin.mcpKeysTab') },
    { to: '/admin/mcp/oauth-clients', label: t('admin.oauthClientsTab') },
    { to: '/admin/mcp/audit-log', label: t('admin.mcpAuditTab') },
    { to: '/admin/audit-log', label: t('admin.auditLogTab') },
    { to: '/admin/activity-log', label: t('admin.activityLogTab') },
  ]

  return (
    <nav className="flex gap-4 border-b border-border pb-2">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            cn(
              'text-sm font-medium text-muted-foreground hover:text-foreground',
              isActive && 'text-foreground underline underline-offset-4',
            )
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}
