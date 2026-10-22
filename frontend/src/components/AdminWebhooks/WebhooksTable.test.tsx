import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { WebhookSummary } from '#api/webhooks'
import { WebhooksTable } from './WebhooksTable'

function webhook(overrides: Partial<WebhookSummary> = {}): WebhookSummary {
  return {
    id: 'hook-1',
    name: 'n8n',
    url: 'http://192.168.1.20:5678/webhook/wiki',
    format: 'json',
    events: ['page.created', 'page.updated'],
    secret: 'whsec_abc',
    enabled: true,
    includePrivatePages: false,
    scopePageId: null,
    consecutiveFailures: 0,
    disabledReason: null,
    createdById: 'admin',
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z',
    lastDelivery: null,
    ...overrides,
  }
}

function renderTable(webhooks: WebhookSummary[]) {
  return render(
    <MemoryRouter>
      <WebhooksTable webhooks={webhooks} />
    </MemoryRouter>,
  )
}

describe('WebhooksTable', () => {
  it('shows the name, host, format, events count and links to the webhook page', () => {
    renderTable([webhook()])

    expect(screen.getByRole('link', { name: 'n8n' })).toHaveAttribute('href', '/admin/webhooks/hook-1')
    expect(screen.getByText('192.168.1.20:5678')).toBeInTheDocument()
    expect(screen.getByText('JSON')).toBeInTheDocument()
    expect(screen.getByText('2 événements')).toBeInTheDocument()
    expect(screen.getByText('Jamais')).toBeInTheDocument()
  })

  it('tells active, disabled and automatically disabled webhooks apart', () => {
    renderTable([
      webhook({ id: 'active', name: 'Actif' }),
      webhook({ id: 'off', name: 'Coupé', enabled: false }),
      webhook({
        id: 'auto',
        name: 'Discord',
        format: 'discord',
        enabled: false,
        consecutiveFailures: 20,
        disabledReason: 'Disabled after 20 consecutive failed deliveries',
      }),
    ])

    const [active, off, auto] = screen.getAllByRole('listitem')
    expect(within(active).getByText('Actif', { selector: '[data-slot=badge]' })).toBeInTheDocument()
    expect(within(off).getByText('Désactivé')).toBeInTheDocument()
    expect(within(auto).getByText('Désactivé automatiquement')).toBeInTheDocument()
    expect(within(auto).getByText("Après 20 échecs d'envoi consécutifs")).toBeInTheDocument()
  })

  it('shows the status of the last delivery', () => {
    renderTable([
      webhook({ lastDelivery: { createdAt: '2026-10-21T08:30:00.000Z', status: 'failed', lastStatusCode: 500 } }),
    ])

    expect(screen.getByText('Échec')).toBeInTheDocument()
    expect(screen.queryByText('Jamais')).not.toBeInTheDocument()
  })

  it('renders an empty state', () => {
    renderTable([])

    expect(screen.getByText('Aucun webhook pour le moment.')).toBeInTheDocument()
  })
})
