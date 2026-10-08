import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { SIDEBAR_COLLAPSED_KEY } from '#hooks/useSidebarCollapsed'
import { Sidebar } from './Sidebar'

vi.mock('#hooks/usePermissions', () => ({
  usePermissions: () => ({ hasGlobal: () => false, canOnPage: () => false }),
}))

vi.mock('#components/layout/PageTree', () => ({
  PageTree: () => <div data-testid="page-tree" />,
}))

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar mobileOpen={false} onMobileOpenChange={() => {}} />
    </MemoryRouter>,
  )
}

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('collapses the page tree and remembers it', () => {
    renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: 'Réduire le panneau' }))

    expect(screen.queryByTestId('page-tree')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Afficher le panneau' })).toBeInTheDocument()
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('true')
  })

  it('starts collapsed when it was collapsed before and expands back', () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'true')
    renderSidebar()

    expect(screen.queryByTestId('page-tree')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Afficher le panneau' }))

    expect(screen.getByTestId('page-tree')).toBeInTheDocument()
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('false')
  })
})
