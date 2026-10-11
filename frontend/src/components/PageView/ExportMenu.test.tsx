import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ExportMenu } from './ExportMenu'

const downloadPageExportMock = vi.fn()
vi.mock('#api/pages', () => ({
  downloadPageExport: (...args: unknown[]) => downloadPageExportMock(...args),
}))

function openMenu() {
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Exporter' }), { button: 0, ctrlKey: false })
}

describe('ExportMenu', () => {
  beforeEach(() => {
    downloadPageExportMock.mockReset().mockResolvedValue(undefined)
  })

  it('offers the sub-page exports only when the page has children', () => {
    const { unmount } = render(<ExportMenu pageId="p1" pathSegments={['docs']} hasChildren={false} />)
    openMenu()
    expect(screen.getByRole('menuitem', { name: 'PDF (cette page)' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Markdown brut (.md)' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'PDF avec les sous-pages' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Markdown avec les sous-pages (.zip)' })).not.toBeInTheDocument()
    unmount()

    render(<ExportMenu pageId="p1" pathSegments={['docs']} hasChildren />)
    openMenu()
    expect(screen.getByRole('menuitem', { name: 'PDF avec les sous-pages' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Markdown avec les sous-pages (.zip)' })).toBeInTheDocument()
  })

  it('prints the page, opens the print view of the subtree and downloads the Markdown exports', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<ExportMenu pageId="p1" pathSegments={['docs', 'guide']} hasChildren />)

    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'PDF (cette page)' }))
    await waitFor(() => expect(print).toHaveBeenCalled())

    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'PDF avec les sous-pages' }))
    expect(open).toHaveBeenCalledWith('/print/docs/guide', '_blank')

    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Markdown avec les sous-pages (.zip)' }))
    await waitFor(() => expect(downloadPageExportMock).toHaveBeenCalledWith('p1', 'subtree'))
  })
})
