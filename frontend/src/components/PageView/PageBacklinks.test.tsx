import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { PageTreeNode } from '#api/pages'
import { PageTreeContext } from '#hooks/usePageTree'
import { PageBacklinks } from './PageBacklinks'

const getBacklinksMock = vi.fn()
vi.mock('#api/pages', () => ({
  getBacklinks: (...args: unknown[]) => getBacklinksMock(...args),
}))

function node(id: string, slug: string, title: string, children: PageTreeNode[] = []): PageTreeNode {
  return { id, slug, title, visibility: 'public', canCreateChild: false, children }
}

const tree = [node('docs', 'docs', 'Documentation', [node('guide', 'guide', 'Guide')]), node('faq', 'faq', 'FAQ')]

function renderBacklinks() {
  return render(
    <MemoryRouter>
      <PageTreeContext.Provider value={{ tree, status: 'success', refresh: vi.fn() }}>
        <PageBacklinks pageId="target" />
      </PageTreeContext.Provider>
    </MemoryRouter>,
  )
}

describe('PageBacklinks', () => {
  beforeEach(() => {
    getBacklinksMock.mockReset()
  })

  it('lists the pages linking here with their breadcrumb', async () => {
    getBacklinksMock.mockResolvedValue([
      { id: 'guide', title: 'Guide', path: '/docs/guide', updatedAt: '' },
      { id: 'faq', title: 'FAQ', path: '/faq', updatedAt: '' },
    ])

    renderBacklinks()

    expect(await screen.findByRole('heading', { name: 'Pages qui pointent ici' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Guide' })).toHaveAttribute('href', '/pages/docs/guide')
    expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/pages/faq')
    expect(screen.getByText('Documentation')).toBeInTheDocument()
    expect(getBacklinksMock).toHaveBeenCalledWith('target')
  })

  it('stays hidden when no page links here', async () => {
    getBacklinksMock.mockResolvedValue([])

    const { container } = renderBacklinks()

    await waitFor(() => expect(getBacklinksMock).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('stays hidden when the backlinks cannot be loaded', async () => {
    getBacklinksMock.mockRejectedValue(new Error('down'))

    const { container } = renderBacklinks()

    await waitFor(() => expect(getBacklinksMock).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
