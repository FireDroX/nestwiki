import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { Webhook, WebhookDelivery } from '#api/webhooks'
import { PageTreeContext } from '#hooks/usePageTree'
import { AdminWebhookDetail } from './AdminWebhookDetail'

const getWebhookMock = vi.fn()
const testWebhookMock = vi.fn()
const rotateWebhookSecretMock = vi.fn()
const listWebhookDeliveriesMock = vi.fn()
const redeliverWebhookDeliveryMock = vi.fn()
const deleteWebhookMock = vi.fn()
vi.mock('#api/webhooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#api/webhooks')>()),
  getWebhook: (...args: unknown[]) => getWebhookMock(...args),
  testWebhook: (...args: unknown[]) => testWebhookMock(...args),
  rotateWebhookSecret: (...args: unknown[]) => rotateWebhookSecretMock(...args),
  listWebhookDeliveries: (...args: unknown[]) => listWebhookDeliveriesMock(...args),
  redeliverWebhookDelivery: (...args: unknown[]) => redeliverWebhookDeliveryMock(...args),
  deleteWebhook: (...args: unknown[]) => deleteWebhookMock(...args),
}))

const webhook: Webhook = {
  id: 'hook-1',
  name: 'n8n',
  url: 'http://192.168.1.20:5678/webhook/wiki',
  format: 'json',
  events: ['page.created'],
  secret: 'whsec_old',
  enabled: true,
  includePrivatePages: false,
  scopePageId: null,
  consecutiveFailures: 0,
  disabledReason: null,
  createdById: 'admin',
  createdAt: '2026-10-20T10:00:00.000Z',
  updatedAt: '2026-10-20T10:00:00.000Z',
}

function delivery(overrides: Partial<WebhookDelivery> = {}): WebhookDelivery {
  return {
    id: 'd1',
    webhookId: 'hook-1',
    event: 'page.created',
    payload: '{"event":"page.created","data":{"page":{"title":"Guide"}}}',
    status: 'failed',
    attempts: 6,
    nextAttemptAt: null,
    lastStatusCode: 502,
    lastError: 'HTTP 502',
    durationMs: 120,
    createdAt: '2026-10-21T08:30:00.000Z',
    deliveredAt: null,
    ...overrides,
  }
}

function renderPage() {
  return render(
    <PageTreeContext.Provider value={{ tree: [], status: 'success', refresh: async () => {} }}>
      <MemoryRouter initialEntries={['/admin/webhooks/hook-1']}>
        <Routes>
          <Route path="/admin/webhooks/:id" element={<AdminWebhookDetail />} />
          <Route path="/admin/webhooks" element={<p>Liste des webhooks</p>} />
        </Routes>
      </MemoryRouter>
    </PageTreeContext.Provider>,
  )
}

describe('AdminWebhookDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getWebhookMock.mockResolvedValue(webhook)
    listWebhookDeliveriesMock.mockResolvedValue({ items: [], total: 0 })
  })

  it('masks the secret until asked, then regenerates it after confirmation', async () => {
    const user = userEvent.setup()
    rotateWebhookSecretMock.mockResolvedValue({ ...webhook, secret: 'whsec_new' })
    renderPage()

    const secret = await screen.findByTestId('webhook-secret')
    expect(secret).not.toHaveTextContent('whsec_old')
    await user.click(screen.getByRole('button', { name: 'Afficher' }))
    expect(secret).toHaveTextContent('whsec_old')

    await user.click(screen.getByRole('button', { name: 'Régénérer' }))
    const confirmation = screen.getByRole('alertdialog')
    expect(confirmation).toHaveTextContent("L'ancien secret cesse immédiatement de fonctionner")
    expect(rotateWebhookSecretMock).not.toHaveBeenCalled()
    await user.click(within(confirmation).getByRole('button', { name: 'Régénérer' }))

    expect(rotateWebhookSecretMock).toHaveBeenCalledWith('hook-1')
    expect(await screen.findByText('whsec_new')).toBeInTheDocument()
  })

  it('sends a test and shows its result on the spot, then refreshes the log and the webhook state', async () => {
    const user = userEvent.setup()
    testWebhookMock.mockResolvedValue(
      delivery({ event: 'webhook.test', status: 'failed', lastStatusCode: 404, durationMs: 87, lastError: 'HTTP 404' }),
    )
    getWebhookMock
      .mockResolvedValueOnce(webhook)
      .mockResolvedValueOnce({ ...webhook, enabled: false, consecutiveFailures: 20, disabledReason: 'Disabled' })
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Envoyer un test' }))

    const panel = await screen.findByLabelText('Résultat du test')
    expect(panel).toHaveTextContent('Échec')
    expect(panel).toHaveTextContent('404')
    expect(panel).toHaveTextContent('87 ms')
    expect(panel).toHaveTextContent('HTTP 404')
    expect(testWebhookMock).toHaveBeenCalledWith('hook-1')
    expect(listWebhookDeliveriesMock).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('Désactivé automatiquement')).toBeInTheDocument()
  })

  it('does not offer to redeliver for a disabled webhook', async () => {
    const user = userEvent.setup()
    getWebhookMock.mockResolvedValue({ ...webhook, enabled: false })
    listWebhookDeliveriesMock.mockResolvedValue({ items: [delivery()], total: 1 })
    renderPage()

    await user.click(await screen.findByRole('button', { name: /21 oct\. 2026/ }))

    const details = screen.getByRole('dialog')
    expect(within(details).queryByRole('button', { name: 'Renvoyer' })).not.toBeInTheDocument()
    expect(details).toHaveTextContent('réactivez-le pour renvoyer cet envoi')
  })

  it('lists the deliveries, filters them by status and shows the payload of one to redeliver it', async () => {
    const user = userEvent.setup()
    listWebhookDeliveriesMock.mockResolvedValue({ items: [delivery()], total: 1 })
    redeliverWebhookDeliveryMock.mockResolvedValue(delivery({ id: 'd2', status: 'success', lastStatusCode: 200 }))
    renderPage()

    expect(await screen.findByText('page.created', { selector: 'dd' })).toBeInTheDocument()
    expect(listWebhookDeliveriesMock).toHaveBeenLastCalledWith('hook-1', { status: undefined, page: 1, limit: 20 })

    await user.click(screen.getByRole('button', { name: /21 oct\. 2026/ }))
    const details = screen.getByRole('dialog')
    expect(details).toHaveTextContent('"title": "Guide"')
    expect(details).toHaveTextContent('HTTP 502')

    await user.click(within(details).getByRole('button', { name: 'Renvoyer' }))

    expect(redeliverWebhookDeliveryMock).toHaveBeenCalledWith('d1')
    expect(listWebhookDeliveriesMock).toHaveBeenCalledTimes(2)
  })

  it('deletes the webhook after confirmation and goes back to the list', async () => {
    const user = userEvent.setup()
    deleteWebhookMock.mockResolvedValue(undefined)
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Supprimer' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }))

    expect(deleteWebhookMock).toHaveBeenCalledWith('hook-1')
    expect(await screen.findByText('Liste des webhooks')).toBeInTheDocument()
  })

  it('reports a webhook that cannot be loaded', async () => {
    getWebhookMock.mockRejectedValue(new Error('not found'))
    renderPage()

    expect(await screen.findByText('Échec du chargement du webhook.')).toBeInTheDocument()
  })
})
