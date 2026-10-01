import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu'
import { Button } from '#components/ui/button'
import { PAGE_ACTIONS, type PageAction } from '#api/permissions'
import type { AccessRuleLike } from '#utils/access-rule-coverage'

interface ActionsMenuProps {
  rule: AccessRuleLike
  disabled: boolean
  onActionsChange: (actions: PageAction[]) => void
  onScopeToggle?: () => void
  availableActions?: PageAction[]
}

export function ActionsMenu({ rule, disabled, onActionsChange, onScopeToggle, availableActions }: ActionsMenuProps) {
  const { t } = useTranslation()

  function toggleAction(action: PageAction, checked: boolean) {
    const next = checked ? [...rule.actions, action] : rule.actions.filter((existing) => existing !== action)
    onActionsChange(next.length === 0 ? ['page.read'] : (next as PageAction[]))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="ml-auto h-6 px-2 text-xs" disabled={disabled}>
          {t('pageAccessTree.actionsCount', { count: rule.actions.length })}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>{t('pageAccessTree.actionsLabel')}</DropdownMenuLabel>
        {PAGE_ACTIONS.map((action) => {
          const isReadAction = action === 'page.read'
          const hasWriteAction = rule.actions.some((existing) => existing !== 'page.read')
          const notHeldByActor = !!availableActions && !availableActions.includes(action)
          const locked = (isReadAction && hasWriteAction) || notHeldByActor
          return (
            <DropdownMenuCheckboxItem
              key={action}
              checked={rule.actions.includes(action)}
              disabled={locked}
              onCheckedChange={(checked) => toggleAction(action, checked)}
              onSelect={(event) => event.preventDefault()}
            >
              {t(`permissions.labels.${action}`)}
            </DropdownMenuCheckboxItem>
          )
        })}
        {onScopeToggle && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={rule.appliesTo === 'page'}
              onCheckedChange={() => onScopeToggle()}
              onSelect={(event) => event.preventDefault()}
            >
              {t('pageAccessTree.pageOnlyScope')}
            </DropdownMenuCheckboxItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
