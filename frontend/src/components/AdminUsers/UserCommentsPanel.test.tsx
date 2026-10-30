import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { AdminUser } from '#api/users'
import { UserCommentsPanel } from './UserCommentsPanel'

vi.mock('#hooks/useUserComments', () => ({
  useUserComments: () => ({
    comments: [
      {
        id: 'c-hidden',
        pageId: null,
        pagePath: null,
        content: null,
        deletedAt: null,
        createdAt: '2026-10-30T10:00:00.000Z',
      },
      {
        id: 'c-visible',
        pageId: 'page-1',
        pagePath: 'docs/page-1',
        content: 'Visible comment',
        deletedAt: null,
        createdAt: '2026-10-30T10:00:00.000Z',
      },
    ],
    total: 2,
    page: 1,
    limit: 20,
    status: 'ready',
    selectedIds: [],
    pending: false,
    toggleSelected: vi.fn(),
    goToPage: vi.fn(),
    purgeSelected: vi.fn(),
    purgeAll: vi.fn(),
  }),
}))

const user = { id: 'user-2', displayName: 'Target' } as AdminUser

describe('UserCommentsPanel', () => {
  it('shows a placeholder for the comments of a page the viewer cannot read', () => {
    render(<UserCommentsPanel user={user} />)

    fireEvent.click(screen.getByRole('button', { name: 'Messages' }))

    expect(screen.getByText("Contenu masqué : vous n'avez pas accès à cette page.")).toBeInTheDocument()
    expect(screen.getByText(/Page à laquelle vous n'avez pas accès/)).toBeInTheDocument()
    expect(screen.getByText('Visible comment')).toBeInTheDocument()
    expect(screen.getByText(/docs\/page-1/)).toBeInTheDocument()
  })
})
