import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { EDITOR_PANEL_COLLAPSED_KEY } from '#hooks/useEditorPanelCollapsed'
import { EditorLayout } from './EditorLayout'

function TitleField() {
  const [value, setValue] = useState('')
  return <input aria-label="Titre test" value={value} onChange={(event) => setValue(event.target.value)} />
}

function renderLayout() {
  return render(
    <MemoryRouter>
      <EditorLayout backTo="/" title="Titre" actions={null} sidebar={<TitleField />}>
        <div>Éditeur</div>
      </EditorLayout>
    </MemoryRouter>,
  )
}

const hideLabel = 'Masquer le panneau des propriétés'
const showLabel = 'Afficher le panneau des propriétés'

function panel() {
  return screen.getByLabelText('Titre test').closest('aside')!
}

describe('EditorLayout', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('shows the panel by default', () => {
    renderLayout()

    expect(screen.getByRole('button', { name: hideLabel })).toHaveAttribute('aria-expanded', 'true')
    expect(panel()).not.toHaveClass('md:hidden')
  })

  it('toggles the panel, keeps its values and remembers the choice', () => {
    renderLayout()
    fireEvent.change(screen.getByLabelText('Titre test'), { target: { value: 'Mon titre' } })

    fireEvent.click(screen.getByRole('button', { name: hideLabel }))

    expect(screen.getByRole('button', { name: showLabel })).toHaveAttribute('aria-expanded', 'false')
    expect(panel()).toHaveClass('md:hidden')
    expect(localStorage.getItem(EDITOR_PANEL_COLLAPSED_KEY)).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: showLabel }))

    expect(panel()).not.toHaveClass('md:hidden')
    expect(screen.getByLabelText('Titre test')).toHaveValue('Mon titre')
    expect(localStorage.getItem(EDITOR_PANEL_COLLAPSED_KEY)).toBe('false')
  })

  it('restores the collapsed state from localStorage', () => {
    localStorage.setItem(EDITOR_PANEL_COLLAPSED_KEY, 'true')

    renderLayout()

    expect(screen.getByRole('button', { name: showLabel })).toHaveAttribute('aria-expanded', 'false')
  })

  it('works when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })

    renderLayout()
    expect(screen.getByRole('button', { name: hideLabel })).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByRole('button', { name: hideLabel }))

    expect(screen.getByRole('button', { name: showLabel })).toHaveAttribute('aria-expanded', 'false')
  })
})
