import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DeletePageDialog } from './DeletePageDialog'

describe('DeletePageDialog', () => {
  it('warns about sub-pages and confirms', () => {
    const onConfirm = vi.fn()
    render(<DeletePageDialog title="Guide" descendantCount={2} pending={false} onConfirm={onConfirm} />)

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(screen.getByText(/Ses 2 sous-pages seront aussi déplacées dans la corbeille/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Déplacer dans la corbeille' }))

    expect(onConfirm).toHaveBeenCalled()
  })

  it('does not mention sub-pages for a leaf page', () => {
    render(<DeletePageDialog title="Guide" descendantCount={0} pending={false} onConfirm={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

    expect(screen.getByText('Supprimer « Guide » ?')).toBeInTheDocument()
    expect(screen.queryByText(/sous-page/)).not.toBeInTheDocument()
  })
})
