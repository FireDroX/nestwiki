import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AdminNav } from './AdminNav'

describe('AdminNav', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('scrolls the active tab into view so it stays visible when the tabs overflow', () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView')

    render(
      <MemoryRouter initialEntries={['/admin/activity-log']}>
        <AdminNav />
      </MemoryRouter>,
    )

    const active = screen.getByRole('link', { current: 'page' })
    expect(active).toHaveAttribute('href', '/admin/activity-log')
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(active)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
  })
})
