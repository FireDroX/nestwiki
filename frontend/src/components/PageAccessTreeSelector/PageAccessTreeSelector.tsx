import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { InputGroup, InputGroupAddon, InputGroupInput } from '#components/ui/input-group'
import { Checkbox } from '#components/ui/checkbox'
import {
  type AccessRule,
  type AccessRuleSubject,
  createAccessRule,
  deleteAccessRule,
  listAccessRules,
  updateAccessRule,
} from '#api/access-rules'
import type { PageAction } from '#api/permissions'
import type { PageTreeNode } from '#api/pages'
import { usePageTree } from '#hooks/usePageTree'
import { filterTree } from '#utils/page-tree'
import {
  buildChainIndex,
  coverageForNode,
  findExcludingAncestorRule,
  nearestCoveringSubtreeRule,
  ownRuleForNode,
} from '#utils/access-rule-coverage'
import { extractErrorMessage } from '#lib/api-errors'
import { ActionsMenu } from '#components/PageAccessTreeSelector/ActionsMenu'
import { PageAccessTreeNode } from '#components/PageAccessTreeSelector/PageAccessTreeNode'

interface PageAccessTreeSelectorProps {
  subject: AccessRuleSubject
  readOnly?: boolean
}

type Status = 'loading' | 'ready' | 'error'

export function PageAccessTreeSelector({ subject, readOnly = false }: PageAccessTreeSelectorProps) {
  const { t } = useTranslation()
  const { tree, status: treeStatus } = usePageTree()
  const [rules, setRules] = useState<AccessRule[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setStatus('loading')
      try {
        const result = await listAccessRules(subject)
        if (cancelled) return
        setRules(result)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.type, subject.id])

  const chainIndex = useMemo(() => buildChainIndex(tree), [tree])
  const isFiltering = search.trim().length > 0
  const visibleTree = useMemo(() => filterTree(tree, search), [tree, search])

  function isExpanded(id: string): boolean {
    return isFiltering || expanded.has(id)
  }

  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function withPending(key: string, fn: () => Promise<void>): Promise<void> {
    setPendingKey(key)
    try {
      await fn()
    } catch (error) {
      toast.error(extractErrorMessage(error, t('pageAccessTree.actionFailed')))
    } finally {
      setPendingKey(null)
    }
  }

  const wholeWikiRule = ownRuleForNode(rules, null, 'subtree')

  async function handleToggleWholeWiki() {
    if (readOnly) return
    if (wholeWikiRule) {
      await withPending('whole-wiki', async () => {
        await deleteAccessRule(subject, wholeWikiRule.id)
        setRules((current) => current.filter((rule) => rule.id !== wholeWikiRule.id))
      })
      return
    }
    await withPending('whole-wiki', async () => {
      const created = await createAccessRule(subject, { pageId: null, appliesTo: 'subtree', actions: ['page.read'] })
      setRules((current) => [...current, created])
    })
  }

  async function handleWholeWikiActionsChange(actions: PageAction[]) {
    if (readOnly || !wholeWikiRule) return
    await withPending('whole-wiki', async () => {
      const updated = await updateAccessRule(subject, wholeWikiRule.id, { actions })
      setRules((current) => current.map((rule) => (rule.id === updated.id ? updated : rule)))
    })
  }

  async function handleToggleNode(node: PageTreeNode) {
    if (readOnly) return
    const chainIds = chainIndex.get(node.id) ?? [node.id]
    const coverage = coverageForNode(node, chainIndex, rules)

    if (coverage === 'none') {
      const excludingRule = findExcludingAncestorRule(rules, chainIds)
      if (excludingRule) {
        await withPending(node.id, async () => {
          const nextExcluded = excludingRule.excludedPageIds.filter((id) => id !== node.id)
          const updated = await updateAccessRule(subject, excludingRule.id, { excludedPageIds: nextExcluded })
          setRules((current) => current.map((rule) => (rule.id === updated.id ? updated : rule)))
        })
        return
      }
      await withPending(node.id, async () => {
        const created = await createAccessRule(subject, { pageId: node.id, appliesTo: 'subtree', actions: ['page.read'] })
        setRules((current) => [...current, created])
      })
      return
    }

    const ownSubtree = ownRuleForNode(rules, node.id, 'subtree')
    const ownPage = ownRuleForNode(rules, node.id, 'page')
    const own = ownSubtree ?? ownPage
    if (own) {
      await withPending(node.id, async () => {
        await deleteAccessRule(subject, own.id)
        setRules((current) => current.filter((rule) => rule.id !== own.id))
      })
      return
    }

    const nearest = nearestCoveringSubtreeRule(rules, chainIds)
    if (nearest) {
      await withPending(node.id, async () => {
        const updated = await updateAccessRule(subject, nearest.id, {
          excludedPageIds: [...nearest.excludedPageIds, node.id],
        })
        setRules((current) => current.map((rule) => (rule.id === updated.id ? updated : rule)))
      })
    }
  }

  async function handleActionsChange(node: PageTreeNode, actions: PageAction[]) {
    if (readOnly) return
    const own = ownRuleForNode(rules, node.id, 'subtree') ?? ownRuleForNode(rules, node.id, 'page')
    if (!own) return
    await withPending(node.id, async () => {
      const updated = await updateAccessRule(subject, own.id, { actions })
      setRules((current) => current.map((rule) => (rule.id === updated.id ? updated : rule)))
    })
  }

  async function handleScopeToggle(node: PageTreeNode) {
    if (readOnly) return
    const ownSubtree = ownRuleForNode(rules, node.id, 'subtree')
    const ownPage = ownRuleForNode(rules, node.id, 'page')
    const current = ownSubtree ?? ownPage
    if (!current) return
    const nextScope: 'page' | 'subtree' = ownSubtree ? 'page' : 'subtree'

    await withPending(node.id, async () => {
      await deleteAccessRule(subject, current.id)
      const created = await createAccessRule(subject, {
        pageId: node.id,
        appliesTo: nextScope,
        actions: current.actions,
        excludedPageIds: nextScope === 'subtree' ? current.excludedPageIds : undefined,
      })
      setRules((prev) => [...prev.filter((rule) => rule.id !== current.id), created])
    })
  }

  const coverage = (node: PageTreeNode) => coverageForNode(node, chainIndex, rules)

  if (status === 'loading' || treeStatus === 'loading') {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  if (status === 'error' || treeStatus === 'error') {
    return <p className="text-sm text-destructive">{t('pageAccessTree.loadError')}</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <InputGroup className="max-w-[320px]">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          placeholder={t('pageAccessTree.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </InputGroup>

      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Checkbox
          checked={!!wholeWikiRule}
          disabled={readOnly || pendingKey === 'whole-wiki'}
          onCheckedChange={handleToggleWholeWiki}
        />
        <span className="text-sm font-medium">{t('pageAccessTree.wholeWiki')}</span>
        {!readOnly && wholeWikiRule && (
          <ActionsMenu
            rule={wholeWikiRule}
            disabled={pendingKey === 'whole-wiki'}
            onActionsChange={handleWholeWikiActionsChange}
          />
        )}
      </div>

      {isFiltering && visibleTree.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('pageAccessTree.noMatch')}</p>
      )}

      <div className="flex flex-col">
        {visibleTree.map((node) => (
          <PageAccessTreeNode
            key={node.id}
            node={node}
            depth={0}
            coverage={coverage}
            rules={rules}
            isExpanded={isExpanded}
            onToggleExpand={toggleExpanded}
            onToggleNode={handleToggleNode}
            onActionsChange={handleActionsChange}
            onScopeToggle={handleScopeToggle}
            pendingKey={pendingKey}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  )
}
