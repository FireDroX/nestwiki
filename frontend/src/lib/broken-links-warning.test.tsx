import { describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { Toaster } from 'sonner'
import { warnAboutBrokenLinks } from './broken-links-warning'

describe('warnAboutBrokenLinks', () => {
  it('lists the broken paths in a warning after a save', async () => {
    render(<Toaster />)

    act(() => warnAboutBrokenLinks(['/docs/old', '/nowhere']))

    expect(await screen.findByText('2 liens pointent vers des pages introuvables')).toBeInTheDocument()
    expect(screen.getByText('/docs/old')).toBeInTheDocument()
    expect(screen.getByText('/nowhere')).toBeInTheDocument()
  })

  it('stays silent when every link resolves', () => {
    render(<Toaster />)

    act(() => warnAboutBrokenLinks([]))
    act(() => warnAboutBrokenLinks(undefined))

    expect(screen.queryByText(/introuvable/)).not.toBeInTheDocument()
  })
})
