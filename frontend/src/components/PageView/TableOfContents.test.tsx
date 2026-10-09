import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TableOfContentsSidebar } from './TableOfContents'

const HEADINGS = [
  { id: 'deploiement', text: 'Déploiement', level: 1 },
  { id: 'prerequis', text: 'Prérequis', level: 2 },
  { id: 'docker', text: 'Docker', level: 3 },
  { id: 'verification', text: 'Vérification', level: 2 },
]

function parentItemOf(name: string): HTMLElement | null | undefined {
  return screen.getByRole('link', { name }).closest('ul')?.closest('li')
}

describe('TableOfContentsSidebar', () => {
  it('nests headings as a tree under their parent heading', () => {
    render(<TableOfContentsSidebar headings={HEADINGS} activeId={null} />)
    expect(screen.getByRole('link', { name: 'Docker' })).toHaveAttribute('href', '#docker')
    expect(parentItemOf('Déploiement')).toBeNull()
    expect(parentItemOf('Prérequis')).toHaveTextContent(/^Déploiement/)
    expect(parentItemOf('Docker')).toHaveTextContent(/^Prérequis/)
    expect(parentItemOf('Vérification')).toHaveTextContent(/^Déploiement/)
  })

  it('marks the active heading', () => {
    render(<TableOfContentsSidebar headings={HEADINGS} activeId="verification" />)
    expect(screen.getByRole('link', { name: 'Vérification' })).toHaveAttribute('aria-current', 'location')
    expect(screen.getByRole('link', { name: 'Prérequis' })).not.toHaveAttribute('aria-current')
  })
})
