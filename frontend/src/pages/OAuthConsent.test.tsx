import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { OAuthConsent } from './OAuthConsent'

const getConsentClientMock = vi.fn()
const postAuthorizeDecisionMock = vi.fn()
let currentRole = 'admin'

vi.mock('#hooks/useAuth', () => ({
  useAuth: () => ({ user: { role: currentRole } }),
}))

vi.mock('#api/oauth', () => ({
  getConsentClient: (...args: unknown[]) => getConsentClientMock(...args),
  postAuthorizeDecision: (...args: unknown[]) => postAuthorizeDecisionMock(...args),
}))

const consentUrl =
  '/oauth/consent?client_id=oauth_client_abc&client_name=Claude%20officiel&redirect_uri=https%3A%2F%2Fattacker.invalid%2Fcb&code_challenge=c&code_challenge_method=S256&scope=pages%3Aread%20pages%3Awrite%20users%3Awrite'

function renderConsent() {
  return render(
    <MemoryRouter initialEntries={[consentUrl]}>
      <OAuthConsent />
    </MemoryRouter>,
  )
}

describe('OAuthConsent', () => {
  beforeEach(() => {
    currentRole = 'admin'
    getConsentClientMock.mockReset().mockResolvedValue({
      name: 'Registered name',
      redirectHost: 'attacker.invalid',
      scopes: ['pages:read', 'pages:write', 'users:write'],
    })
    postAuthorizeDecisionMock.mockReset().mockResolvedValue({ redirectUrl: 'https://attacker.invalid/cb?code=x' })
  })

  it('shows the redirect host and the registered name, never the name from the URL', async () => {
    renderConsent()

    expect(await screen.findByText('attacker.invalid')).toBeInTheDocument()
    expect(screen.getByText(/Registered name/)).toBeInTheDocument()
    expect(screen.queryByText(/Claude officiel/)).not.toBeInTheDocument()
    expect(screen.getByText(/NestWiki ne peut pas vérifier son nom/)).toBeInTheDocument()
    expect(getConsentClientMock).toHaveBeenCalledWith({
      clientId: 'oauth_client_abc',
      redirectUri: 'https://attacker.invalid/cb',
      scope: 'pages:read pages:write users:write',
    })
  })

  it('grants only the read scopes when read only is ticked', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('location', { ...window.location, assign: vi.fn() })
    renderConsent()

    await user.click(await screen.findByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Autoriser' }))

    expect(postAuthorizeDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'allow', scope: 'pages:read' }),
    )
    vi.unstubAllGlobals()
  })

  it('does not load the client for a non-admin', () => {
    currentRole = 'member'
    renderConsent()

    expect(screen.getByText('Seul un compte administrateur peut autoriser cette connexion.')).toBeInTheDocument()
    expect(getConsentClientMock).not.toHaveBeenCalled()
  })
})
