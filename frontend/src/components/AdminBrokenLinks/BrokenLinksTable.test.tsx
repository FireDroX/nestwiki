import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { BrokenPageLink } from '#api/admin-links'
import { BrokenLinksTable } from './BrokenLinksTable'

const link: BrokenPageLink = {
  sourcePage: { id: 'guide', title: 'Guide', path: '/docs/guide' },
  targetPath: '/docs/old',
}

function renderTable(items: BrokenPageLink[]) {
  return render(
    <MemoryRouter>
      <BrokenLinksTable items={items} />
    </MemoryRouter>,
  )
}

describe('BrokenLinksTable', () => {
  it('links each source page to its editor and shows the missing target', () => {
    renderTable([link])

    expect(screen.getByRole('link', { name: 'Guide' })).toHaveAttribute('href', '/edit/docs/guide')
    expect(screen.getByText('/docs/guide')).toBeInTheDocument()
    expect(screen.getByText('/docs/old')).toBeInTheDocument()
  })

  it('renders an empty state', () => {
    renderTable([])

    expect(screen.getByText('Aucun lien cassé.')).toBeInTheDocument()
  })
})
