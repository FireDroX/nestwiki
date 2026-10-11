import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setPrintMode } from '#lib/print-mode'
import { MarkdownRenderer } from './MarkdownRenderer'

const mermaidMock = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }))
vi.mock('mermaid', () => ({ default: mermaidMock }))
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }))

const DIAGRAM = '```mermaid\ngraph TD\n  A --> B\n```'

describe('Mermaid diagrams while printing', () => {
  beforeEach(() => {
    setPrintMode(false)
    mermaidMock.initialize.mockReset()
    mermaidMock.render.mockReset().mockResolvedValue({ svg: '<svg data-testid="diagram"></svg>' })
  })

  it('redraws the diagrams in the light theme in print mode and flags them as pending meanwhile', async () => {
    const { container } = render(<MarkdownRenderer content={DIAGRAM} mode="full" />)
    await screen.findByTestId('diagram')
    expect(mermaidMock.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'dark' }))

    let finishRender: (value: { svg: string }) => void = () => {}
    mermaidMock.render.mockReturnValue(new Promise((resolve) => (finishRender = resolve)))
    act(() => setPrintMode(true))

    await vi.waitFor(() =>
      expect(mermaidMock.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'default' })),
    )
    expect(container.querySelector('[data-print-pending]')).not.toBeNull()

    await act(async () => finishRender({ svg: '<svg data-testid="diagram"></svg>' }))
    expect(container.querySelector('[data-print-pending]')).toBeNull()
  })
})
