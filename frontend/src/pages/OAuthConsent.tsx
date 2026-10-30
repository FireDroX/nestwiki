import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { Checkbox } from '#components/ui/checkbox'
import { getConsentClient, postAuthorizeDecision, type OAuthConsentClient } from '#api/oauth'
import { UserRole } from '#api/auth'
import { useAuth } from '#hooks/useAuth'
import { extractErrorMessage } from '#lib/api-errors'

const READ_SCOPE_SUFFIX = ':read'

type ConsentClientState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; client: OAuthConsentClient }

export function OAuthConsent() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [pending, setPending] = useState<'allow' | 'deny' | null>(null)
  const [readOnly, setReadOnly] = useState(false)
  const [consentClient, setConsentClient] = useState<ConsentClientState>({ status: 'loading' })

  const clientId = searchParams.get('client_id') ?? ''
  const redirectUri = searchParams.get('redirect_uri') ?? ''
  const codeChallenge = searchParams.get('code_challenge') ?? ''
  const codeChallengeMethod = searchParams.get('code_challenge_method') ?? ''
  const state = searchParams.get('state') ?? undefined
  const requestedScope = searchParams.get('scope') ?? undefined

  const isAdmin = user?.role === UserRole.Admin

  useEffect(() => {
    if (!isAdmin) {
      return
    }
    let cancelled = false
    getConsentClient({ clientId, redirectUri, scope: requestedScope })
      .then((client) => {
        if (!cancelled) {
          setConsentClient({ status: 'ready', client })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConsentClient({ status: 'error' })
        }
      })
    return () => {
      cancelled = true
    }
  }, [isAdmin, clientId, redirectUri, requestedScope])

  const requestedScopes = consentClient.status === 'ready' ? consentClient.client.scopes : []
  const readScopes = requestedScopes.filter((scope) => scope.endsWith(READ_SCOPE_SUFFIX))
  const canRestrictToReadOnly = readScopes.length > 0 && readScopes.length < requestedScopes.length
  const grantedScopes = readOnly && canRestrictToReadOnly ? readScopes : requestedScopes

  async function handleDecision(decision: 'allow' | 'deny') {
    setPending(decision)
    try {
      const { redirectUrl } = await postAuthorizeDecision({
        clientId,
        redirectUri,
        codeChallenge,
        codeChallengeMethod,
        state,
        scope: grantedScopes.join(' '),
        decision,
      })
      window.location.assign(redirectUrl)
    } catch (error) {
      toast.error(extractErrorMessage(error))
      setPending(null)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold">{t('oauthConsent.title')}</h1>
          {consentClient.status === 'ready' && (
            <p className="mt-2 text-sm text-muted-foreground">
              {t('oauthConsent.description', { name: consentClient.client.name })}
            </p>
          )}
        </div>

        {!isAdmin && <p className="text-sm text-destructive">{t('oauthConsent.notAdmin')}</p>}
        {isAdmin && consentClient.status === 'loading' && (
          <p className="text-center text-sm text-muted-foreground">{t('oauthConsent.loading')}</p>
        )}
        {isAdmin && consentClient.status === 'error' && (
          <p className="text-sm text-destructive">{t('oauthConsent.loadError')}</p>
        )}
        {isAdmin && consentClient.status === 'ready' && (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p className="text-muted-foreground">{t('oauthConsent.redirectTo')}</p>
              <p className="mt-1 font-mono font-semibold break-all">{consentClient.client.redirectHost}</p>
            </div>

            <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p>{t('oauthConsent.unverified')}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t('oauthConsent.scopesLabel')}</p>
              <div className="flex flex-wrap gap-1">
                {grantedScopes.map((scope) => (
                  <Badge key={scope} variant="secondary" className="font-mono">
                    {scope}
                  </Badge>
                ))}
              </div>
              {canRestrictToReadOnly && (
                <label className="flex items-start gap-2 pt-1 text-sm">
                  <Checkbox checked={readOnly} onCheckedChange={(checked) => setReadOnly(checked === true)} />
                  <span>
                    <span className="font-medium">{t('oauthConsent.readOnly')}</span>
                    <span className="block text-muted-foreground">{t('oauthConsent.readOnlyHint')}</span>
                  </span>
                </label>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={pending !== null}
                onClick={() => handleDecision('deny')}
              >
                {t('oauthConsent.deny')}
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={pending !== null}
                onClick={() => handleDecision('allow')}
              >
                {t('oauthConsent.allow')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
