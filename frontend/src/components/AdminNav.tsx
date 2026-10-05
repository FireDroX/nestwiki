import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '#lib/utils'

export function AdminNav() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const navRef = useRef<HTMLElement>(null)
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

  useEffect(() => {
    navRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [pathname])

  return (
    <nav
      ref={navRef}
      className="-mx-4 flex scroll-px-4 gap-1 overflow-x-auto border-b border-border px-4 sm:scroll-px-6 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:gap-x-4 lg:gap-y-1 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            cn(
              'flex min-h-10 shrink-0 items-center whitespace-nowrap px-2 text-sm font-medium text-muted-foreground hover:text-foreground lg:min-h-0 lg:px-0 lg:pb-2',
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
