import { ChevronRight, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '#components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#components/ui/collapsible'
import type { PageAction } from '#api/permissions'
import type { PageTreeNode } from '#api/pages'
import { cn } from '#lib/utils'
import { ownRuleForNode, type AccessRuleLike, type NodeCoverage } from '#utils/access-rule-coverage'
import { ActionsMenu } from '#components/PageAccessTreeSelector/ActionsMenu'

export interface PageAccessTreeNodeProps {
  node: PageTreeNode
  depth: number
  coverage: (node: PageTreeNode) => NodeCoverage
  rules: AccessRuleLike[]
  isExpanded: (id: string) => boolean
  onToggleExpand: (id: string) => void
  onToggleNode: (node: PageTreeNode) => void
  onActionsChange: (node: PageTreeNode, actions: PageAction[]) => void
  onScopeToggle: (node: PageTreeNode) => void
  pendingKey: string | null
  readOnly?: boolean
}

export function PageAccessTreeNode({
  node,
  depth,
  coverage,
  rules,
  isExpanded,
  onToggleExpand,
  onToggleNode,
  onActionsChange,
  onScopeToggle,
  pendingKey,
  readOnly = false,
}: PageAccessTreeNodeProps) {
  const { t } = useTranslation()
  const hasChildren = node.children.length > 0
  const expanded = hasChildren && isExpanded(node.id)
  const state = coverage(node)
  const isPending = pendingKey === node.id
  const ownRule = ownRuleForNode(rules, node.id, 'subtree') ?? ownRuleForNode(rules, node.id, 'page')
  const canConfigure = !readOnly && !!ownRule

  const checkboxState = state === 'full' ? true : state === 'partial' ? 'indeterminate' : false

  const row = (
    <div className="flex items-center gap-1 py-1" style={{ paddingLeft: depth * 20 }}>
      {hasChildren ? (
        <CollapsibleTrigger className="flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-accent">
          <ChevronRight className={cn('size-4 transition-transform', expanded && 'rotate-90')} />
          <span className="sr-only">{t('pageAccessTree.toggleExpand', { title: node.title })}</span>
        </CollapsibleTrigger>
      ) : (
        <span className="size-6 shrink-0" />
      )}

      <Checkbox
        checked={checkboxState}
        disabled={readOnly || isPending}
        onCheckedChange={() => onToggleNode(node)}
      />

      {node.visibility === 'private' && (
        <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label={t('pageAccessTree.privatePage')} />
      )}

      <span className="truncate text-sm">{node.title}</span>

      {canConfigure && (
        <ActionsMenu
          rule={ownRule}
          disabled={isPending}
          onActionsChange={(actions) => onActionsChange(node, actions)}
          onScopeToggle={() => onScopeToggle(node)}
        />
      )}
    </div>
  )

  if (!hasChildren) {
    return row
  }

  return (
    <Collapsible open={expanded} onOpenChange={() => onToggleExpand(node.id)}>
      {row}
      <CollapsibleContent>
        {node.children.map((child) => (
          <PageAccessTreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            coverage={coverage}
            rules={rules}
            isExpanded={isExpanded}
            onToggleExpand={onToggleExpand}
            onToggleNode={onToggleNode}
            onActionsChange={onActionsChange}
            onScopeToggle={onScopeToggle}
            pendingKey={pendingKey}
            readOnly={readOnly}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
