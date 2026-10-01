import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageAccessTreeNode } from '#components/PageAccessTreeSelector/PageAccessTreeNode'
import { buildChainIndex, coverageForNode } from '#utils/access-rule-coverage'
import type { PageTreeNode } from '#api/pages'

interface SubtreeExclusionTreeProps {
  rootNode: PageTreeNode
  excludedPageIds: string[]
  onChange: (excludedPageIds: string[]) => void
}

function noop() {}

export function SubtreeExclusionTree({ rootNode, excludedPageIds, onChange }: SubtreeExclusionTreeProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const chainIndex = useMemo(() => buildChainIndex([rootNode]), [rootNode])

  const pendingRule = {
    pageId: rootNode.id,
    appliesTo: 'subtree' as const,
    actions: ['page.read' as const],
    excludedPageIds,
  }

  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleExcluded(node: PageTreeNode) {
    onChange(
      excludedPageIds.includes(node.id)
        ? excludedPageIds.filter((id) => id !== node.id)
        : [...excludedPageIds, node.id],
    )
  }

  if (rootNode.children.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('pageAccessPanel.noSubpages')}</p>
  }

  return (
    <div className="flex flex-col rounded-md border">
      {rootNode.children.map((child) => (
        <PageAccessTreeNode
          key={child.id}
          node={child}
          depth={0}
          coverage={(node) => coverageForNode(node, chainIndex, [pendingRule])}
          rules={[pendingRule]}
          isExpanded={(id) => expanded.has(id)}
          onToggleExpand={toggleExpanded}
          onToggleNode={toggleExcluded}
          onActionsChange={noop}
          onScopeToggle={noop}
          pendingKey={null}
        />
      ))}
    </div>
  )
}
