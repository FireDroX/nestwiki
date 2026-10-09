import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TableOfContentsSidebar } from './TableOfContents'

const HEADINGS = [
  { id: 'installation', text: 'Installation', level: 2 },
  { id: 'prerequis', text: 'Prérequis', level: 3 },
  { id: 'configuration', text: 'Configuration', level: 2 },
]

describe('TableOfContentsSidebar', () => {
  it('links each heading to its anchor, indented relative to the top level', () => {
    render(<TableOfContentsSidebar headings={HEADINGS} activeId={null} />)
    const link = screen.getByRole('link', { name: 'Prérequis' })
    expect(link).toHaveAttribute('href', '#prerequis')
    expect(link.parentElement).toHaveClass('pl-3')
    expect(screen.getByRole('link', { name: 'Installation' }).parentElement).toHaveClass('pl-0')
  })

  it('marks the active heading', () => {
    render(<TableOfContentsSidebar headings={HEADINGS} activeId="configuration" />)
    expect(screen.getByRole('link', { name: 'Configuration' })).toHaveAttribute('aria-current', 'location')
    expect(screen.getByRole('link', { name: 'Installation' })).not.toHaveAttribute('aria-current')
  })
})
