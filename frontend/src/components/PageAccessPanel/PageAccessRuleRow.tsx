import { Link } from 'react-router'
import { Trash2, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Avatar, AvatarFallback } from '#components/ui/avatar'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { ActionsMenu } from '#components/PageAccessTreeSelector/ActionsMenu'
import type { PageAccessRule } from '#api/page-access-rules'
import type { PageAction } from '#api/permissions'
import { toInitials } from '#utils/initials'

interface PageAccessRuleRowProps {
  rule: PageAccessRule
  originPath: string[] | null
  availableActions: PageAction[]
  pending: boolean
  onActionsChange: (actions: PageAction[]) => void
  onDelete: () => void
}

export function PageAccessRuleRow({
  rule,
  originPath,
  availableActions,
  pending,
  onActionsChange,
  onDelete,
}: PageAccessRuleRowProps) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
      {rule.subject.type === 'group' ? (
        <Users className="size-5 shrink-0 text-muted-foreground" />
      ) : (
        <Avatar className="size-6 shrink-0">
          <AvatarFallback className="text-[10px]">{toInitials(rule.subject.name)}</AvatarFallback>
        </Avatar>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{rule.subject.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {rule.appliesTo === 'subtree' ? t('pageAccessPanel.scopeSubtree') : t('pageAccessPanel.scopePageOnly')}
          {rule.inherited && (
            <>
              {' · '}
              {rule.pageId === null ? (
                t('pageAccessTree.wholeWiki')
              ) : originPath ? (
                <Link to={`/pages/${originPath.join('/')}`} className="underline hover:text-foreground">
                  {originPath.at(-1)}
                </Link>
              ) : (
                t('pageAccessPanel.inheritedUnknownOrigin')
              )}
            </>
          )}
        </p>
      </div>

      {rule.inherited ? (
        <Badge
          variant="outline"
          className="shrink-0"
          title={rule.actions.map((action) => t(`permissions.labels.${action}`)).join(', ')}
        >
          {t('pageAccessTree.actionsCount', { count: rule.actions.length })}
        </Badge>
      ) : (
        <>
          <ActionsMenu rule={rule} disabled={pending} onActionsChange={onActionsChange} availableActions={availableActions} />
          <Button type="button" variant="ghost" size="icon-sm" disabled={pending} onClick={onDelete}>
            <Trash2 />
            <span className="sr-only">{t('pageAccessPanel.deleteRuleSr', { name: rule.subject.name })}</span>
          </Button>
        </>
      )}
    </div>
  )
}
