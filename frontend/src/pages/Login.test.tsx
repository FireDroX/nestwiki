import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { AuthContext, type AuthContextValue } from '#hooks/useAuth'
import { Login } from './Login'

// The real widget loads Cloudflare's script and never resolves in
// jsdom, leaving the submit button permanently disabled — verify
// immediately instead, same as it behaves with no site key configured.
vi.mock('#components/Turnstile', () => ({
  TurnstileWidget: ({ onVerify }: { onVerify: (token: string) => void }) => {
    onVerify('test-token')
    return null
  },
}))

function renderLogin(overrides: Partial<AuthContextValue> = {}, path = '/login') {
  const auth: AuthContextValue = {
    user: null,
    status: 'unauthenticated',
    login: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    refreshUser: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }

  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={auth}>
        <Login />
      </AuthContext.Provider>
    </MemoryRouter>,
  )

  return auth
}

describe('Login', () => {
  it('calls login() with the entered credentials on a valid submission', async () => {
    const user = userEvent.setup()
    const auth = renderLogin()

    await user.type(screen.getByLabelText('Adresse e-mail'), 'alice@example.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'whatever-it-takes')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    await waitFor(() => {
      expect(auth.login).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'alice@example.com',
          password: 'whatever-it-takes',
        }),
      )
    })
  })

  it('displays the server error message inline when login() rejects', async () => {
    const user = userEvent.setup()
    const auth = renderLogin({
      login: vi.fn().mockRejectedValue({
        isAxiosError: true,
        response: { status: 401, data: { error: 'Email ou mot de passe incorrect' } },
      }),
    })

    await user.type(screen.getByLabelText('Adresse e-mail'), 'alice@example.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(await screen.findByText('Email ou mot de passe incorrect')).toBeInTheDocument()
    expect(auth.login).toHaveBeenCalledTimes(1)
  })

  describe('redirect after login', () => {
    const assign = vi.fn()

    beforeEach(() => {
      vi.stubGlobal('location', { ...window.location, origin: window.location.origin, assign })
    })

    afterEach(() => {
      assign.mockReset()
      vi.unstubAllGlobals()
    })

    function loginPath(redirect: string): string {
      return `/login?redirect=${encodeURIComponent(redirect)}`
    }

    async function submit(user: ReturnType<typeof userEvent.setup>) {
      await user.type(screen.getByLabelText('Adresse e-mail'), 'alice@example.com')
      await user.type(screen.getByLabelText('Mot de passe'), 'whatever-it-takes')
      await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    }

    it.each(['javascript:alert(1)', 'https://evil.example/'])(
      'never follows %s, before or after logging in',
      async (redirect) => {
        renderLogin({ status: 'authenticated' }, loginPath(redirect))
        expect(assign).not.toHaveBeenCalled()
        cleanup()

        const user = userEvent.setup()
        const auth = renderLogin({}, loginPath(redirect))
        await submit(user)

        await waitFor(() => expect(auth.login).toHaveBeenCalled())
        expect(assign).not.toHaveBeenCalled()
      },
    )

    it('follows a same-origin destination such as the OAuth consent page', async () => {
      const path = loginPath(`${window.location.origin}/oauth/consent?client_id=c1&state=s`)
      renderLogin({ status: 'authenticated' }, path)
      expect(assign).toHaveBeenCalledWith('/oauth/consent?client_id=c1&state=s')
      assign.mockReset()
      cleanup()

      const user = userEvent.setup()
      renderLogin({}, path)
      await submit(user)

      await waitFor(() => expect(assign).toHaveBeenCalledWith('/oauth/consent?client_id=c1&state=s'))
    })
  })
})
