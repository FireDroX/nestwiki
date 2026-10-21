import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { Toaster, toast } from 'sonner'
import { announcePageMove } from './page-move-toast'

describe('announcePageMove', () => {
  it('sums up the links updated after the move', async () => {
    render(<Toaster />)

    act(() => announcePageMove({ linksUpdated: 12, pagesUpdated: 4, pagesSkipped: 0 }))

    expect(await screen.findByText('Page déplacée.')).toBeInTheDocument()
    expect(screen.getByText('12 liens mis à jour dans 4 pages')).toBeInTheDocument()
  })

  it('mentions the pages whose links could not be updated', async () => {
    render(<Toaster />)

    act(() => announcePageMove({ linksUpdated: 1, pagesUpdated: 1, pagesSkipped: 1 }))

    expect(await screen.findByText('1 lien mis à jour dans 1 page')).toBeInTheDocument()
    expect(screen.getByText("1 page n'a pas pu être modifiée, ses liens restent cassés")).toBeInTheDocument()
  })

  it('only confirms the move when no link was touched', () => {
    const success = vi.spyOn(toast, 'success')

    announcePageMove({ linksUpdated: 0, pagesUpdated: 0, pagesSkipped: 0 })

    expect(success).toHaveBeenCalledWith('Page déplacée.')
    success.mockRestore()
  })
})
