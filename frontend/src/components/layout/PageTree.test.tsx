import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { PageTreeContext } from '#hooks/usePageTree'
import type { PageTreeNode } from '#api/pages'
import { PageTree } from './PageTree'

const tree: PageTreeNode[] = [
  {
    id: 'doc',
    slug: 'documentation',
    title: 'Documentation',
    canCreateChild: false, visibility: 'public',
    children: [
      {
        id: 'guide',
        slug: 'guide',
        title: 'Guide',
        canCreateChild: false, visibility: 'public',
        children: [
          {
            id: 'install',
            slug: 'installation',
            title: 'Installation',
            canCreateChild: false, visibility: 'public',
            children: [],
          },
        ],
      },
    ],
  },
  { id: 'faq', slug: 'faq', title: 'FAQ', canCreateChild: false, visibility: 'public', children: [] },
]

function renderTree(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <PageTreeContext.Provider value={{ tree, status: 'success', refresh: async () => {} }}>
        <Routes>
          <Route path="/pages/*" element={<PageTree />} />
        </Routes>
      </PageTreeContext.Provider>
    </MemoryRouter>,
  )
}

describe('PageTree', () => {
  it('renders every level of a multi-level tree', () => {
    renderTree('/pages/documentation/guide/installation')

    expect(screen.getByText('Documentation')).toBeInTheDocument()
    expect(screen.getByText('Guide')).toBeInTheDocument()
    expect(screen.getByText('Installation')).toBeInTheDocument()
    expect(screen.getByText('FAQ')).toBeInTheDocument()
  })

  it('highlights the active node matching the current path', () => {
    renderTree('/pages/documentation/guide/installation')

    const activeLink = screen.getByText('Installation').closest('a')
    const inactiveLink = screen.getByText('Guide').closest('a')

    expect(activeLink).toHaveClass('bg-sidebar-accent')
    expect(inactiveLink).not.toHaveClass('bg-sidebar-accent')
  })

  it('auto-expands the ancestors of the active node so it is visible', () => {
    renderTree('/pages/documentation/guide/installation')

    // Nested descendants are only in the DOM when their ancestor
    // Collapsible is open — this only passes if 'documentation' and
    // 'guide' both auto-expanded because they are ancestors of the
    // active 'installation' node.
    expect(screen.getByText('Installation')).toBeVisible()
  })
})

const collidingSlugTree: PageTreeNode[] = [
  {
    id: 'esgi',
    slug: 'esgi',
    title: 'ESGI',
    canCreateChild: false, visibility: 'public',
    children: [
      {
        id: 's1',
        slug: 's1',
        title: 'S1',
        canCreateChild: false, visibility: 'public',
        children: [
          { id: 's1-reseau', slug: 'reseau', title: 'Reseau S1', canCreateChild: false, visibility: 'public', children: [] },
        ],
      },
      {
        id: 's2',
        slug: 's2',
        title: 'S2',
        canCreateChild: false, visibility: 'public',
        children: [
          { id: 's2-reseau', slug: 'reseau', title: 'Reseau S2', canCreateChild: false, visibility: 'public', children: [] },
        ],
      },
    ],
  },
]

function renderCollidingSlugTree(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <PageTreeContext.Provider
        value={{ tree: collidingSlugTree, status: 'success', refresh: async () => {} }}
      >
        <Routes>
          <Route path="/pages/*" element={<PageTree />} />
        </Routes>
      </PageTreeContext.Provider>
    </MemoryRouter>,
  )
}

describe('PageTree with the same leaf slug under different parents', () => {
  it('expands the branch that actually matches the full active path', () => {
    renderCollidingSlugTree('/pages/esgi/s2/reseau')

    expect(screen.getByText('Reseau S2')).toBeVisible()
    expect(screen.queryByText('Reseau S1')).not.toBeInTheDocument()
  })

  it('highlights only the node matching the full active path', () => {
    renderCollidingSlugTree('/pages/esgi/s2/reseau')

    const activeLink = screen.getByText('Reseau S2').closest('a')
    expect(activeLink).toHaveClass('bg-sidebar-accent')
  })
})
