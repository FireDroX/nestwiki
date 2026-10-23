import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AdminBrokenLinks } from './AdminBrokenLinks'

const listBrokenLinksMock = vi.fn()
vi.mock('#api/admin-links', () => ({
  listBrokenLinks: (...args: unknown[]) => listBrokenLinksMock(...args),
}))

function renderPage(path = '/admin/links') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminBrokenLinks />
    </MemoryRouter>,
  )
}

describe('AdminBrokenLinks', () => {
  beforeEach(() => {
    listBrokenLinksMock.mockReset()
  })

  it('pages through the broken links', async () => {
    listBrokenLinksMock.mockResolvedValue({
      items: [{ sourcePage: { id: 'guide', title: 'Guide', path: '/docs/guide' }, targetPath: '/docs/old' }],
      total: 120,
    })

    renderPage()

    expect(await screen.findByText('/docs/old')).toBeInTheDocument()
    expect(listBrokenLinksMock).toHaveBeenLastCalledWith({ page: 1, limit: 50 })
    expect(screen.getByText('Page 1 / 3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }))

    expect(await screen.findByText('Page 2 / 3')).toBeInTheDocument()
    expect(listBrokenLinksMock).toHaveBeenLastCalledWith({ page: 2, limit: 50 })
  })

  it('says so when there is no broken link', async () => {
    listBrokenLinksMock.mockResolvedValue({ items: [], total: 0 })

    renderPage()

    expect(await screen.findByText('Aucun lien cassé.')).toBeInTheDocument()
  })

  it('reports a loading failure', async () => {
    listBrokenLinksMock.mockRejectedValue(new Error('down'))

    renderPage()

    expect(await screen.findByText('Échec du chargement des liens cassés.')).toBeInTheDocument()
  })
})
