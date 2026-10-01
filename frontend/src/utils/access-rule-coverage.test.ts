import { describe, expect, it } from 'vitest'
import type { PageTreeNode } from '#api/pages'
import {
  buildChainIndex,
  coverageForNode,
  findExcludingAncestorRule,
  nearestCoveringSubtreeRule,
  ownRuleForNode,
  type AccessRuleLike,
} from './access-rule-coverage'

function node(id: string, children: PageTreeNode[] = []): PageTreeNode {
  return { id, slug: id, title: id, visibility: 'private', canCreateChild: true, children }
}

function rule(overrides: Partial<AccessRuleLike>): AccessRuleLike {
  return { pageId: null, appliesTo: 'subtree', actions: ['page.read'], excludedPageIds: [], ...overrides }
}

const tree: PageTreeNode[] = [
  node('documentation', [node('guide'), node('interne')]),
  node('faq'),
]

describe('access-rule-coverage', () => {
  it('covers a whole subtree with a single subtree rule', () => {
    const chainIndex = buildChainIndex(tree)
    const rules: AccessRuleLike[] = [rule({ pageId: 'documentation', appliesTo: 'subtree' })]

    const documentation = tree[0]
    expect(coverageForNode(documentation, chainIndex, rules)).toBe('full')
    expect(coverageForNode(documentation.children[0], chainIndex, rules)).toBe('full')
    expect(coverageForNode(documentation.children[1], chainIndex, rules)).toBe('full')
    expect(coverageForNode(tree[1], chainIndex, rules)).toBe('none')
  })

  it('excluding a descendant produces a single rule with an exclusion, and the parent becomes partial', () => {
    const chainIndex = buildChainIndex(tree)
    const rules: AccessRuleLike[] = [
      rule({ pageId: 'documentation', appliesTo: 'subtree', excludedPageIds: ['interne'] }),
    ]

    const documentation = tree[0]
    expect(coverageForNode(documentation.children[0], chainIndex, rules)).toBe('full')
    expect(coverageForNode(documentation.children[1], chainIndex, rules)).toBe('none')
    expect(coverageForNode(documentation, chainIndex, rules)).toBe('partial')
  })

  it('re-checking an excluded descendant is found via findExcludingAncestorRule', () => {
    const chainIndex = buildChainIndex(tree)
    const excludingRule = rule({ pageId: 'documentation', appliesTo: 'subtree', excludedPageIds: ['interne'] })
    const rules: AccessRuleLike[] = [excludingRule]

    const found = findExcludingAncestorRule(rules, chainIndex.get('interne')!)
    expect(found).toBe(excludingRule)
  })

  it('nearestCoveringSubtreeRule finds the closest ancestor rule, not a farther one', () => {
    const chainIndex = buildChainIndex(tree)
    const wholeWiki = rule({ pageId: null, appliesTo: 'subtree' })
    const docSubtree = rule({ pageId: 'documentation', appliesTo: 'subtree' })
    const rules: AccessRuleLike[] = [wholeWiki, docSubtree]

    const nearest = nearestCoveringSubtreeRule(rules, chainIndex.get('guide')!)
    expect(nearest).toBe(docSubtree)
  })

  it('a page-scope rule only covers its own page, not descendants', () => {
    const chainIndex = buildChainIndex(tree)
    const rules: AccessRuleLike[] = [rule({ pageId: 'documentation', appliesTo: 'page' })]

    expect(coverageForNode(tree[0], chainIndex, rules)).toBe('partial')
    expect(coverageForNode(tree[0].children[0], chainIndex, rules)).toBe('none')
  })

  it('ownRuleForNode distinguishes page-scope from subtree-scope rules at the same pageId', () => {
    const subtreeRule = rule({ pageId: 'documentation', appliesTo: 'subtree' })
    const rules: AccessRuleLike[] = [subtreeRule]

    expect(ownRuleForNode(rules, 'documentation', 'subtree')).toBe(subtreeRule)
    expect(ownRuleForNode(rules, 'documentation', 'page')).toBeUndefined()
  })

  it('a write action implies page.read in the effective actions', () => {
    const chainIndex = buildChainIndex(tree)
    const rules: AccessRuleLike[] = [
      rule({ pageId: 'documentation', appliesTo: 'subtree', actions: ['page.edit'] }),
    ]

    expect(coverageForNode(tree[0], chainIndex, rules)).toBe('full')
  })
})
