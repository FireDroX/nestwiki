import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '#components/ui/badge'
import { getEffectivePermissions, type UserEffectivePermissions } from '#api/users'
import type { PageTreeNode } from '#api/pages'
import { usePageTree } from '#hooks/usePageTree'

interface EffectivePermissionsTabProps {
  userId: string
}

function flattenPageTitles(nodes: PageTreeNode[]): Map<string, string> {
  const map = new Map<string, string>()
  function walk(node: PageTreeNode) {
    map.set(node.id, node.title)
    for (const child of node.children) walk(child)
  }
  for (const node of nodes) walk(node)
  return map
}

export function EffectivePermissionsTab({ userId }: EffectivePermissionsTabProps) {
  const { t } = useTranslation()
  const { tree } = usePageTree()
  const [explanation, setExplanation] = useState<UserEffectivePermissions | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const titleById = useMemo(() => flattenPageTitles(tree), [tree])

  useEffect(() => {
    setStatus('loading')
    getEffectivePermissions(userId)
      .then((result) => {
        setExplanation(result)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [userId])

  if (status === 'loading') {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }
  if (status === 'error' || !explanation) {
    return <p className="text-sm text-destructive">{t('admin.users.effectivePermissionsLoadError')}</p>
  }

  if (explanation.isAdmin) {
    return <p className="text-sm text-muted-foreground">{t('admin.users.effectiveIsAdmin')}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">{t('admin.users.effectiveGlobalPermissions')}</p>
        {explanation.globalPermissions.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('admin.users.effectiveNone')}</p>
        )}
        <ul className="flex flex-col gap-1.5">
          {explanation.globalPermissions.map((entry) => (
            <li key={entry.permission} className="flex items-center gap-2 text-sm">
              <span>{t(`permissions.labels.${entry.permission}`)}</span>
              {entry.origins.map((origin, index) => (
                <Badge key={index} variant={origin.type === 'direct' ? 'secondary' : 'outline'}>
                  {origin.type === 'direct' ? t('admin.users.originDirect') : origin.groupName}
                </Badge>
              ))}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">{t('admin.users.effectivePageAccess')}</p>
        {explanation.accessRules.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('admin.users.effectiveNone')}</p>
        )}
        <ul className="flex flex-col gap-1.5">
          {explanation.accessRules.map((rule) => (
            <li key={rule.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="shrink-0 truncate font-medium">
                {rule.pageId === null ? t('pageAccessTree.wholeWiki') : titleById.get(rule.pageId) ?? rule.pageId}
              </span>
              <span className="text-xs text-muted-foreground">
                {rule.appliesTo === 'subtree' ? t('admin.users.scopeSubtree') : t('admin.users.scopePage')}
              </span>
              <span className="text-xs text-muted-foreground">
                {rule.actions.map((action) => t(`permissions.labels.${action}`)).join(', ')}
              </span>
              <Badge variant={rule.origin.type === 'direct' ? 'secondary' : 'outline'}>
                {rule.origin.type === 'direct' ? t('admin.users.originDirect') : rule.origin.groupName}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
