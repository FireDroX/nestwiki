import { describe, expect, it } from 'vitest'
import { resolveLogTargetLink, type LogTarget } from './log-target-link'

const paths: Record<string, string> = { 'page-1': 'docs/guide' }
const resolvePagePath = (pageId: string) => paths[pageId] ?? null

function link(entry: Partial<LogTarget> & Pick<LogTarget, 'action' | 'targetType'>) {
  return resolveLogTargetLink({ targetId: null, metadata: null, ...entry }, resolvePagePath)
}

describe('resolveLogTargetLink', () => {
  it('links a page log to the page', () => {
    expect(link({ action: 'page.updated', targetType: 'page', targetId: 'page-1' })).toBe('/pages/docs/guide')
  })

  it('does not link a page that is no longer in the tree', () => {
    expect(link({ action: 'page.updated', targetType: 'page', targetId: 'gone' })).toBeNull()
  })

  it('links a deleted page to the trash and leaves a purged page unlinked', () => {
    expect(link({ action: 'page.deleted', targetType: 'page', targetId: 'page-1' })).toBe('/trash')
    expect(link({ action: 'page.purged', targetType: 'page', targetId: 'page-1' })).toBeNull()
  })

  it.each(['auth.login', 'user.avatar_uploaded', 'user.role.update', 'comment.purged_by_moderator'])(
    'links %s to the admin user profile whatever the target type casing',
    (action) => {
      expect(link({ action, targetType: action.startsWith('comment') ? 'User' : 'user', targetId: 'u1' })).toBe(
        '/admin/users/u1',
      )
    },
  )

  it('opens the matching tab of the user or group', () => {
    expect(link({ action: 'user.groups.update', targetType: 'user', targetId: 'u1' })).toBe('/admin/users/u1?tab=groups')
    expect(link({ action: 'user.permissions.update', targetType: 'user', targetId: 'u1' })).toBe(
      '/admin/users/u1?tab=permissions',
    )
    expect(link({ action: 'group.members.update', targetType: 'group', targetId: 'g1' })).toBe('/admin/groups/g1')
    expect(link({ action: 'group.permissions.update', targetType: 'group', targetId: 'g1' })).toBe(
      '/admin/groups/g1?tab=permissions',
    )
  })

  it('does not link a deleted user or group', () => {
    expect(link({ action: 'user.delete', targetType: 'user', targetId: 'u1' })).toBeNull()
    expect(link({ action: 'group.delete', targetType: 'group', targetId: 'g1' })).toBeNull()
  })

  it('opens the access panel of the page an access rule is on', () => {
    expect(
      link({ action: 'access_rule.create', targetType: 'group', targetId: 'g1', metadata: { pageId: 'page-1' } }),
    ).toBe('/pages/docs/guide?access=open')
  })

  it('falls back to the access tab of the beneficiary for a whole-wiki rule or an older entry', () => {
    expect(
      link({ action: 'access_rule.create', targetType: 'group', targetId: 'g1', metadata: { pageId: null } }),
    ).toBe('/admin/groups/g1?tab=access')
    expect(link({ action: 'access_rule.delete', targetType: 'user', targetId: 'u1', metadata: { ruleId: 'r1' } })).toBe(
      '/admin/users/u1?tab=access',
    )
  })

  it('links comments and media to the page they belong to', () => {
    expect(
      link({ action: 'comment.created', targetType: 'comment', targetId: 'c1', metadata: { pageId: 'page-1' } }),
    ).toBe('/pages/docs/guide')
    expect(
      link({ action: 'comment.deleted_by_moderator', targetType: 'Comment', targetId: 'c1', metadata: { pageId: 'page-1' } }),
    ).toBe('/pages/docs/guide')
    expect(
      link({ action: 'media.uploaded', targetType: 'attachment', targetId: 'a1', metadata: { pageId: 'page-1' } }),
    ).toBe('/pages/docs/guide')
    expect(link({ action: 'media.uploaded', targetType: 'attachment', targetId: 'a1', metadata: { pageId: null } })).toBeNull()
    expect(link({ action: 'media.deleted', targetType: 'attachment', targetId: 'a1' })).toBeNull()
  })

  it('links OAuth client events to the OAuth clients page', () => {
    expect(link({ action: 'mcp.oauth_authorized', targetType: 'oauth_client', targetId: 'o1' })).toBe(
      '/admin/mcp/oauth-clients',
    )
  })

  it('leaves unknown targets unlinked', () => {
    expect(link({ action: 'something.else', targetType: 'mystery', targetId: 'x' })).toBeNull()
  })
})
