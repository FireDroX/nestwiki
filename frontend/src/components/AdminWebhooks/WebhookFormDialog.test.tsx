import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '#components/ui/button'
import type { PageTreeNode } from '#api/pages'
import type { Webhook } from '#api/webhooks'
import { PageTreeContext } from '#hooks/usePageTree'
import { WebhookFormDialog } from './WebhookFormDialog'

const createWebhookMock = vi.fn()
const updateWebhookMock = vi.fn()
vi.mock('#api/webhooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#api/webhooks')>()),
  createWebhook: (...args: unknown[]) => createWebhookMock(...args),
  updateWebhook: (...args: unknown[]) => updateWebhookMock(...args),
}))

const tree: PageTreeNode[] = [
  {
    id: 'docs',
    slug: 'docs',
    title: 'Docs',
    visibility: 'public',
    canCreateChild: true,
    children: [{ id: 'guide', slug: 'guide', title: 'Guide', visibility: 'private', canCreateChild: true, children: [] }],
  },
]

const existing: Webhook = {
  id: 'hook-1',
  name: 'Discord',
  url: 'https://discord.com/api/webhooks/1/abc',
  format: 'discord',
  events: ['page.created'],
  secret: 'whsec_abc',
  enabled: false,
  includePrivatePages: false,
  scopePageId: null,
  consecutiveFailures: 20,
  disabledReason: 'Disabled after 20 consecutive failed deliveries',
  createdById: 'admin',
  createdAt: '2026-10-20T10:00:00.000Z',
  updatedAt: '2026-10-20T10:00:00.000Z',
}

function renderDialog(props: { webhook?: Webhook; onSaved?: (webhook: Webhook) => void } = {}) {
  return render(
    <PageTreeContext.Provider value={{ tree, status: 'success', refresh: async () => {} }}>
      <WebhookFormDialog
        webhook={props.webhook}
        onSaved={props.onSaved ?? vi.fn()}
        trigger={<Button type="button">Ouvrir</Button>}
      />
    </PageTreeContext.Provider>,
  )
}

describe('WebhookFormDialog', () => {
  beforeEach(() => {
    createWebhookMock.mockReset()
    updateWebhookMock.mockReset()
  })

  it('validates the name, the URL and the events before sending anything', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: 'Ouvrir' }))
    await user.type(screen.getByLabelText('URL'), 'ftp://example.com')
    await user.click(screen.getByRole('button', { name: 'Créer le webhook' }))

    expect(await screen.findByText('Le nom est requis')).toBeInTheDocument()
    expect(screen.getByText('Saisissez une adresse http:// ou https:// valide')).toBeInTheDocument()
    expect(screen.getByText('Choisissez au moins un événement')).toBeInTheDocument()
    expect(createWebhookMock).not.toHaveBeenCalled()
  })

  it('proposes the Discord format from a Discord webhook address', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: 'Ouvrir' }))
    expect(screen.getByRole('combobox', { name: 'Format' })).toHaveTextContent('JSON')

    await user.click(screen.getByLabelText('URL'))
    await user.paste('https://discord.com/api/webhooks/123/abc')

    expect(screen.getByRole('combobox', { name: 'Format' })).toHaveTextContent('Discord')
    expect(screen.getByText('Adresse Discord reconnue : format proposé automatiquement.')).toBeInTheDocument()
  })

  it('warns that private pages will be sent to the external service', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: 'Ouvrir' }))
    const checkbox = screen.getByRole('checkbox', { name: 'Inclure les pages privées' })
    expect(checkbox).not.toBeChecked()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.click(checkbox)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Les titres et chemins des pages privées seront envoyés à ce service externe.',
    )
  })

  it('creates a webhook limited to a subtree with every event', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    const created = { ...existing, id: 'new-hook' }
    createWebhookMock.mockResolvedValue(created)
    renderDialog({ onSaved })

    await user.click(screen.getByRole('button', { name: 'Ouvrir' }))
    await user.click(screen.getByLabelText('Nom'))
    await user.paste('  n8n  ')
    await user.click(screen.getByLabelText('URL'))
    await user.paste('http://192.168.1.20:5678/webhook/wiki')
    await user.click(screen.getByRole('checkbox', { name: 'Tout cocher' }))
    await user.click(screen.getByRole('checkbox', { name: 'Docs' }))
    expect(screen.getByText('Limité à : Docs')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Créer le webhook' }))

    expect(createWebhookMock).toHaveBeenCalledWith({
      name: 'n8n',
      url: 'http://192.168.1.20:5678/webhook/wiki',
      format: 'json',
      events: [
        'page.created',
        'page.updated',
        'page.moved',
        'page.deleted',
        'page.restored',
        'page.published',
        'comment.created',
        'pages.imported',
      ],
      includePrivatePages: false,
      scopePageId: 'docs',
      enabled: true,
    })
    expect(onSaved).toHaveBeenCalledWith(created)
  })

  it('only sends the changed fields when editing, so an automatic deactivation is kept', async () => {
    const user = userEvent.setup()
    updateWebhookMock.mockResolvedValue({ ...existing, name: 'Discord #wiki' })
    renderDialog({ webhook: existing })

    await user.click(screen.getByRole('button', { name: 'Ouvrir' }))
    expect(screen.getByLabelText('Nom')).toHaveValue('Discord')
    await user.type(screen.getByLabelText('Nom'), ' #wiki')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(updateWebhookMock).toHaveBeenCalledWith('hook-1', { name: 'Discord #wiki' })
  })
})
