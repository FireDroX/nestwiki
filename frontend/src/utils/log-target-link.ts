export interface LogTarget {
  action: string
  targetType: string
  targetId: string | null
  metadata: unknown
}

export type PagePathResolver = (pageId: string) => string | null

const USER_TAB_BY_ACTION: Record<string, string> = {
  'user.groups.update': 'groups',
  'user.permissions.update': 'permissions',
}

const GROUP_TAB_BY_ACTION: Record<string, string> = {
  'group.permissions.update': 'permissions',
}

const UNLINKED_ACTIONS = new Set(['user.delete', 'group.delete', 'page.purged', 'media.deleted', 'webhook.delete'])

function metadataPageId(metadata: unknown): string | null {
  if (typeof metadata !== 'object' || metadata === null) return null
  const pageId = (metadata as { pageId?: unknown }).pageId
  return typeof pageId === 'string' && pageId.length > 0 ? pageId : null
}

function withTab(path: string, tab: string | undefined): string {
  return tab ? `${path}?tab=${tab}` : path
}

function pageLink(pageId: string | null, resolvePagePath: PagePathResolver, query = ''): string | null {
  if (!pageId) return null
  const path = resolvePagePath(pageId)
  return path ? `/pages/${path}${query}` : null
}

function subjectLink(targetType: string, targetId: string, tab?: string): string | null {
  if (targetType === 'user') return withTab(`/admin/users/${targetId}`, tab)
  if (targetType === 'group') return withTab(`/admin/groups/${targetId}`, tab)
  return null
}

export function resolveLogTargetLink(entry: LogTarget, resolvePagePath: PagePathResolver): string | null {
  if (UNLINKED_ACTIONS.has(entry.action)) return null

  const targetType = entry.targetType.toLowerCase()
  const { targetId } = entry

  if (entry.action.startsWith('access_rule.')) {
    const pageAccess = pageLink(metadataPageId(entry.metadata), resolvePagePath, '?access=open')
    return pageAccess ?? (targetId ? subjectLink(targetType, targetId, 'access') : null)
  }

  if (entry.action === 'page.deleted') return '/trash'

  switch (targetType) {
    case 'user':
      return targetId ? subjectLink('user', targetId, USER_TAB_BY_ACTION[entry.action]) : null
    case 'group':
      return targetId ? subjectLink('group', targetId, GROUP_TAB_BY_ACTION[entry.action]) : null
    case 'page':
      return pageLink(targetId, resolvePagePath)
    case 'comment':
    case 'attachment':
      return pageLink(metadataPageId(entry.metadata), resolvePagePath)
    case 'oauth_client':
      return '/admin/mcp/oauth-clients'
    case 'webhook':
      return targetId ? `/admin/webhooks/${targetId}` : null
    default:
      return null
  }
}
