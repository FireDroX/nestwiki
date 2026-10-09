import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MarkdownRenderer } from './MarkdownRenderer'

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(),
}))

vi.mock('mermaid', () => ({ default: mermaidMock }))

const DIAGRAM = '```mermaid\ngraph TD\n  A --> B\n```'

describe('Mermaid diagrams', () => {
  beforeEach(() => {
    mermaidMock.initialize.mockReset()
    mermaidMock.render.mockReset()
    mermaidMock.render.mockResolvedValue({ svg: '<svg data-testid="diagram"></svg>' })
  })

  it('renders a mermaid code block as an SVG diagram in full mode, in strict security mode', async () => {
    const { container } = render(<MarkdownRenderer content={DIAGRAM} mode="full" />)
    expect(await screen.findByTestId('diagram')).toBeInTheDocument()
    expect(container.querySelector('[data-slot="mermaid-diagram"]')).not.toBeNull()
    expect(mermaidMock.render).toHaveBeenCalledWith(expect.stringMatching(/^mermaid-/), 'graph TD\n  A --> B')
    expect(mermaidMock.initialize).toHaveBeenCalledWith(expect.objectContaining({ securityLevel: 'strict' }))
  })

  it('shows the source code while the diagram is loading', () => {
    mermaidMock.render.mockReturnValue(new Promise(() => {}))
    const { container } = render(<MarkdownRenderer content={DIAGRAM} mode="full" />)
    expect(container.querySelector('pre code')).toHaveTextContent('graph TD A --> B')
  })

  it('shows an error and the source code when the syntax is invalid', async () => {
    mermaidMock.render.mockRejectedValue(new Error('Parse error on line 2'))
    const { container } = render(<MarkdownRenderer content={DIAGRAM} mode="full" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Diagramme Mermaid invalide : Parse error on line 2')
    expect(container.querySelector('pre code')).toHaveTextContent('graph TD')
  })

  it('keeps a mermaid block as a regular code block in restricted mode', async () => {
    const { container } = render(<MarkdownRenderer content={DIAGRAM} />)
    await waitFor(() => expect(container).toHaveTextContent('graph TD'))
    expect(container.querySelector('[data-slot="mermaid-diagram"]')).toBeNull()
    expect(mermaidMock.render).not.toHaveBeenCalled()
  })

  it('does not let restricted mode forge a diagram with raw HTML', () => {
    const { container } = render(<MarkdownRenderer content="<wiki-mermaid>graph TD</wiki-mermaid>" />)
    expect(container.querySelector('[data-slot="mermaid-diagram"]')).toBeNull()
    expect(mermaidMock.render).not.toHaveBeenCalled()
  })
})
