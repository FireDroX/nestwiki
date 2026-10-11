import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { usePrintMode } from '#lib/print-mode'
import { MemoryRouter, Route, Routes } from 'react-router'
import { PrintSubtree } from './PrintSubtree'

const getPageByPathMock = vi.fn()
const getSubtreeContentMock = vi.fn()
vi.mock('#hooks/useAuth', () => ({
  useAuth: () => ({ user: { displayName: 'Alice Martin' } }),
}))

const isPrintableContentReadyMock = vi.fn(() => true)
vi.mock('#utils/printable-content', () => ({
  isPrintableContentReady: () => isPrintableContentReadyMock(),
}))

vi.mock('#api/pages', () => ({
  getPageByPath: (...args: unknown[]) => getPageByPathMock(...args),
  getSubtreeContent: (...args: unknown[]) => getSubtreeContentMock(...args),
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/print/*" element={<PrintSubtree />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PrintSubtree', () => {
  beforeEach(() => {
    isPrintableContentReadyMock.mockReturnValue(true)
    getPageByPathMock.mockReset().mockResolvedValue({ id: 'guide' })
    getSubtreeContentMock.mockReset().mockResolvedValue([
      { id: 'guide', title: 'Guide', slug: 'guide', path: '/docs/guide', depth: 0, content: 'Intro text', tags: [], updatedAt: '' },
      { id: 'install', title: 'Installation', slug: 'install', path: '/docs/guide/install', depth: 1, content: 'Install text', tags: [], updatedAt: '' },
    ])
  })

  it('renders a cover, a global table of contents and every page, then opens the print dialog', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})

    renderAt('/print/docs/guide')

    expect(await screen.findByRole('heading', { level: 1, name: 'Guide' })).toBeInTheDocument()
    expect(getPageByPathMock).toHaveBeenCalledWith(['docs', 'guide'])
    expect(getSubtreeContentMock).toHaveBeenCalledWith('guide')
    const contents = screen.getByRole('navigation', { name: 'Sommaire' })
    expect(within(contents).getByRole('link', { name: 'Installation' })).toHaveAttribute('href', '#print-page-install')
    expect(screen.getByText('Intro text')).toBeInTheDocument()
    expect(screen.getByText('Install text')).toBeInTheDocument()
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1))
  })

  it('draws diagrams in print mode while the print view is open', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {})
    const { result } = renderHook(() => usePrintMode())

    const { unmount } = renderAt('/print/docs/guide')
    await screen.findByText('Intro text')
    expect(result.current).toBe(true)

    unmount()
    expect(result.current).toBe(false)
  })

  it('shows an error when the pages cannot be loaded', async () => {
    getSubtreeContentMock.mockRejectedValue(new Error('forbidden'))

    renderAt('/print/docs/guide')

    expect(await screen.findByText("Impossible de préparer l'impression de ces pages.")).toBeInTheDocument()
  })

  it('does not print on its own when the content is still not ready after the timeout, and lets the user print anyway', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    print.mockClear()
    isPrintableContentReadyMock.mockReturnValue(false)

    renderAt('/print/docs/guide')
    await screen.findByText('Intro text')
    await vi.advanceTimersByTimeAsync(16000)

    expect(print).not.toHaveBeenCalled()
    expect(screen.getByText(/ne sont pas encore prêts/)).toBeInTheDocument()
    screen.getByRole('button', { name: 'Imprimer quand même' }).click()
    expect(print).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
