import type { PageTreeNode } from '#api/pages'
import type { PageAction } from '#api/permissions'

export interface AccessRuleLike {
  pageId: string | null
  appliesTo: 'page' | 'subtree'
  actions: PageAction[]
  excludedPageIds: string[]
}

export function buildChainIndex(nodes: PageTreeNode[]): Map<string, string[]> {
  const index = new Map<string, string[]>()

  function walk(node: PageTreeNode, ancestors: string[]) {
    const chainIds = [node.id, ...ancestors]
    index.set(node.id, chainIds)
    for (const child of node.children) {
      walk(child, chainIds)
    }
  }

  for (const node of nodes) {
    walk(node, [])
  }
  return index
}

function ruleCoversChain(rule: AccessRuleLike, chainIds: string[]): boolean {
  const pageId = chainIds[0]

  if (rule.appliesTo === 'page') {
    return rule.pageId === pageId && !rule.excludedPageIds.includes(pageId)
  }

  const boundaryIndex = rule.pageId === null ? chainIds.length - 1 : chainIds.indexOf(rule.pageId)
  if (boundaryIndex === -1) {
    return false
  }

  for (let i = 0; i <= boundaryIndex; i += 1) {
    if (rule.excludedPageIds.includes(chainIds[i])) {
      return false
    }
  }
  return true
}

export function coveringRulesForChain<T extends AccessRuleLike>(rules: T[], chainIds: string[]): T[] {
  return rules.filter((rule) => ruleCoversChain(rule, chainIds))
}

function boundaryIndexFor(rule: AccessRuleLike, chainIds: string[]): number {
  return rule.pageId === null ? chainIds.length - 1 : chainIds.indexOf(rule.pageId)
}

// A rule rooted at the top-level ancestor of `chainIds` shares its boundaryIndex
// with the whole-wiki rule (pageId: null) — both resolve to the last chain index.
// On a tie, the rule with a concrete pageId is the more specific (nearer) one.
function isCloser(
  candidate: { boundaryIndex: number; pageId: string | null },
  current: { boundaryIndex: number; pageId: string | null },
): boolean {
  if (candidate.boundaryIndex !== current.boundaryIndex) {
    return candidate.boundaryIndex < current.boundaryIndex
  }
  return candidate.pageId !== null && current.pageId === null
}

export function nearestCoveringSubtreeRule<T extends AccessRuleLike>(rules: T[], chainIds: string[]): T | null {
  let best: { rule: T; boundaryIndex: number; pageId: string | null } | null = null
  for (const rule of rules) {
    if (rule.appliesTo !== 'subtree' || !ruleCoversChain(rule, chainIds)) {
      continue
    }
    const boundaryIndex = boundaryIndexFor(rule, chainIds)
    const candidate = { rule, boundaryIndex, pageId: rule.pageId }
    if (!best || isCloser(candidate, best)) {
      best = candidate
    }
  }
  return best?.rule ?? null
}

export function findExcludingAncestorRule<T extends AccessRuleLike>(rules: T[], chainIds: string[]): T | null {
  const nodeId = chainIds[0]
  let best: { rule: T; boundaryIndex: number; pageId: string | null } | null = null
  for (const rule of rules) {
    if (rule.appliesTo !== 'subtree' || !rule.excludedPageIds.includes(nodeId)) {
      continue
    }
    const boundaryIndex = boundaryIndexFor(rule, chainIds)
    if (boundaryIndex === -1) {
      continue
    }
    const candidate = { rule, boundaryIndex, pageId: rule.pageId }
    if (!best || isCloser(candidate, best)) {
      best = candidate
    }
  }
  return best?.rule ?? null
}

export function ownRuleForNode<T extends AccessRuleLike>(
  rules: T[],
  pageId: string | null,
  appliesTo: 'page' | 'subtree',
): T | undefined {
  return rules.find((rule) => rule.pageId === pageId && rule.appliesTo === appliesTo)
}

export function effectiveActionsForChain(rules: AccessRuleLike[], chainIds: string[]): Set<PageAction> {
  const actions = new Set<PageAction>()
  for (const rule of coveringRulesForChain(rules, chainIds)) {
    for (const action of rule.actions) {
      actions.add(action)
    }
  }
  if ([...actions].some((action) => action !== 'page.read')) {
    actions.add('page.read')
  }
  return actions
}

export type NodeCoverage = 'none' | 'partial' | 'full'

export function coverageForNode(
  node: PageTreeNode,
  chainIndex: Map<string, string[]>,
  rules: AccessRuleLike[],
): NodeCoverage {
  const own = effectiveActionsForChain(rules, chainIndex.get(node.id) ?? [node.id]).size > 0

  if (node.children.length === 0) {
    return own ? 'full' : 'none'
  }

  const childStates = node.children.map((child) => coverageForNode(child, chainIndex, rules))
  const allChildrenFull = childStates.every((state) => state === 'full')
  const anyCoverage = own || childStates.some((state) => state !== 'none')

  if (!anyCoverage) {
    return 'none'
  }
  if (own && allChildrenFull) {
    return 'full'
  }
  return 'partial'
}
