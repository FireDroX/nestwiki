import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { MergeConflictDetails } from '#api/pages'
import { ConflictResolver } from './ConflictResolver'

const conflict: MergeConflictDetails = {
  segments: [
    { type: 'ok', lines: ['Intro', 'Second line'] },
    { type: 'conflict', mine: ['Mine A'], base: ['Base A'], theirs: ['Theirs A'] },
    { type: 'conflict', mine: ['Mine B'], base: ['Base B'], theirs: ['Theirs B'] },
  ],
  currentVersionAuthorName: 'Alice',
  currentVersionCreatedAt: new Date().toISOString(),
}

describe('ConflictResolver', () => {
  it('enables apply only once every conflict is resolved and applies the recomposed content', () => {
    const onApply = vi.fn()
    render(<ConflictResolver conflict={conflict} onApply={onApply} onDiscard={vi.fn()} />)

    const apply = screen.getByRole('button', { name: 'Appliquer' })
    expect(apply).toBeDisabled()
    expect(screen.getByText('0 / 2 conflits résolus')).toBeInTheDocument()

    const [first, second] = screen.getAllByTestId('merge-conflict')
    fireEvent.click(within(first).getByRole('button', { name: 'Garder la mienne' }))
    expect(apply).toBeDisabled()
    fireEvent.click(within(second).getByRole('button', { name: 'Garder les deux' }))

    expect(screen.getByText('2 / 2 conflits résolus')).toBeInTheDocument()
    expect(apply).toBeEnabled()
    fireEvent.click(apply)
    expect(onApply).toHaveBeenCalledWith('Intro\nSecond line\nMine A\nMine B\nTheirs B')
  })

  it('lets a choice be changed before applying', () => {
    const onApply = vi.fn()
    render(<ConflictResolver conflict={conflict} onApply={onApply} onDiscard={vi.fn()} />)
    const [first, second] = screen.getAllByTestId('merge-conflict')

    fireEvent.click(within(first).getByRole('button', { name: 'Garder la mienne' }))
    fireEvent.click(within(first).getByRole('button', { name: 'Garder la leur' }))
    fireEvent.click(within(second).getByRole('button', { name: 'Garder la leur' }))
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }))

    expect(onApply).toHaveBeenCalledWith('Intro\nSecond line\nTheirs A\nTheirs B')
  })

  it('names the author of the other version', () => {
    render(<ConflictResolver conflict={conflict} onApply={vi.fn()} onDiscard={vi.fn()} />)
    expect(screen.getAllByText(/Alice/).length).toBeGreaterThan(0)
  })

  it('collapses identical lines', () => {
    render(<ConflictResolver conflict={conflict} onApply={vi.fn()} onDiscard={vi.fn()} />)
    expect(screen.queryByText(/Second line/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '2 lignes identiques' }))
    expect(screen.getByText(/Second line/)).toBeInTheDocument()
  })

  it('discards my changes with the other version content', () => {
    const onDiscard = vi.fn()
    render(<ConflictResolver conflict={conflict} onApply={vi.fn()} onDiscard={onDiscard} />)
    fireEvent.click(screen.getByRole('button', { name: 'Abandonner mes modifications' }))
    expect(onDiscard).toHaveBeenCalledWith('Intro\nSecond line\nTheirs A\nTheirs B')
  })
})
