import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '#components/ui/checkbox'
import { InputGroup, InputGroupAddon, InputGroupInput } from '#components/ui/input-group'
import { PageAccessTreeNode } from '#components/PageAccessTreeSelector/PageAccessTreeNode'
import type { PageTreeNode } from '#api/pages'
import { usePageTree } from '#hooks/usePageTree'
import { buildChainIndex, coverageForNode } from '#utils/access-rule-coverage'
import { filterTree, flattenTree } from '#utils/page-tree'

interface WebhookScopeTreeProps {
  value: string | null
  onChange: (scopePageId: string | null) => void
  disabled?: boolean
}

function noop() {}

export function WebhookScopeTree({ value, onChange, disabled = false }: WebhookScopeTreeProps) {
  const { t } = useTranslation()
  const { tree, status } = usePageTree()
  const [search, setSearch] = useState('')
  const chainIndex = useMemo(() => buildChainIndex(tree), [tree])
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set((value && chainIndex.get(value)?.slice(1)) || []))
  const visibleTree = useMemo(() => filterTree(tree, search), [tree, search])
  const scopePath = useMemo(
    () => (value ? (flattenTree(tree).find((page) => page.id === value)?.path ?? null) : null),
    [tree, value],
  )
  const scopeRule = value
    ? [{ pageId: value, appliesTo: 'subtree' as const, actions: ['page.read' as const], excludedPageIds: [] }]
    : []
  const isFiltering = search.trim().length > 0

  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleNode(node: PageTreeNode) {
    onChange(node.id === value ? null : node.id)
  }

  if (status === 'loading') {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  if (status === 'error') {
    return <p className="text-sm text-destructive">{t('pageAccessTree.loadError')}</p>
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label className="flex items-center gap-2 text-sm font-medium">
        <Checkbox checked={value === null} disabled={disabled || value === null} onCheckedChange={() => onChange(null)} />
        {t('pageAccessTree.wholeWiki')}
      </label>
      {value && (
        <p className="text-xs break-words text-muted-foreground">
          {scopePath ? t('admin.webhooks.form.scopeSelected', { path: scopePath }) : t('admin.webhooks.form.scopeMissing')}
        </p>
      )}
      <InputGroup>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          placeholder={t('pageAccessTree.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </InputGroup>
      <div className="max-h-60 overflow-y-auto rounded-md border border-border px-1">
        {visibleTree.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">{t('pageAccessTree.noMatch')}</p>
        ) : (
          visibleTree.map((node) => (
            <PageAccessTreeNode
              key={node.id}
              node={node}
              depth={0}
              coverage={(candidate) => coverageForNode(candidate, chainIndex, scopeRule)}
              rules={[]}
              isExpanded={(id) => isFiltering || expanded.has(id)}
              onToggleExpand={toggleExpanded}
              onToggleNode={toggleNode}
              onActionsChange={noop}
              onScopeToggle={noop}
              pendingKey={null}
              readOnly={disabled}
            />
          ))
        )}
      </div>
    </div>
  )
}
