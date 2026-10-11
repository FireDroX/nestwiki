import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { TrashEntry } from '#api/pages'
import { TrashTable } from './TrashTable'

const entry: TrashEntry = {
  id: 'p1',
  title: 'Guide',
  path: '/docs/guide',
  deletedAt: new Date().toISOString(),
  deletedBy: { id: 'u1', displayName: 'Alice' },
  descendantCount: 2,
}

describe('TrashTable', () => {
  it('shows restore for everyone and permanent deletion only for admins', () => {
    const { rerender } = render(
      <TrashTable entries={[entry]} isAdmin={false} pendingId={null} onRestore={vi.fn()} onPurge={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'Restaurer' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Supprimer définitivement' })).not.toBeInTheDocument()

    rerender(<TrashTable entries={[entry]} isAdmin pendingId={null} onRestore={vi.fn()} onPurge={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Supprimer définitivement' })).toBeInTheDocument()
  })

  it('restores the clicked page', () => {
    const onRestore = vi.fn()
    render(<TrashTable entries={[entry]} isAdmin={false} pendingId={null} onRestore={onRestore} onPurge={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Restaurer' }))

    expect(onRestore).toHaveBeenCalledWith('p1')
  })

  it('purges after confirmation', () => {
    const onPurge = vi.fn()
    render(<TrashTable entries={[entry]} isAdmin pendingId={null} onRestore={vi.fn()} onPurge={onPurge} />)

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))
    expect(onPurge).not.toHaveBeenCalled()
    expect(screen.getByText(/ainsi que ses 2 sous-pages/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

    expect(onPurge).toHaveBeenCalledWith('p1')
  })

  it('does not mention sub-pages when purging a leaf page', () => {
    render(
      <TrashTable entries={[{ ...entry, descendantCount: 0 }]} isAdmin pendingId={null} onRestore={vi.fn()} onPurge={vi.fn()} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))

    expect(screen.queryByText(/sous-page/)).not.toBeInTheDocument()
  })

  it('shows who deleted the page and its old path', () => {
    render(<TrashTable entries={[entry]} isAdmin={false} pendingId={null} onRestore={vi.fn()} onPurge={vi.fn()} />)

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('/docs/guide')).toBeInTheDocument()
  })

  it('renders an empty state', () => {
    render(<TrashTable entries={[]} isAdmin={false} pendingId={null} onRestore={vi.fn()} onPurge={vi.fn()} />)

    expect(screen.getByText('La corbeille est vide.')).toBeInTheDocument()
  })
})
