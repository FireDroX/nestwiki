import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { AdminNav } from '#components/AdminNav'
import { OAuthClientsTable } from '#components/AdminOAuthClients/OAuthClientsTable'
import { listOAuthClients, revokeOAuthToken, type OAuthClientSummary } from '#api/admin-oauth'
import { extractErrorMessage } from '#lib/api-errors'
import { PAGE_PADDING } from '#utils/page-layout'

type Status = 'loading' | 'ready' | 'error'

export function AdminOAuthClients() {
  const { t } = useTranslation()
  const [clients, setClients] = useState<OAuthClientSummary[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [pendingTokenId, setPendingTokenId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setStatus('loading')
      try {
        const result = await listOAuthClients()
        if (cancelled) return
        setClients(result)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleRevoke(clientId: string, tokenId: string) {
    setPendingTokenId(tokenId)
    try {
      await revokeOAuthToken(clientId, tokenId)
      setClients((current) =>
        current.map((client) =>
          client.id === clientId
            ? { ...client, activeTokens: client.activeTokens.filter((token) => token.id !== tokenId) }
            : client,
        ),
      )
      toast.success(t('admin.oauthClients.revoked'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('admin.oauthClients.revokeFailed')))
    } finally {
      setPendingTokenId(null)
    }
  }

  return (
    <div className={PAGE_PADDING}>
      <AdminNav />
      <div className="mt-5 mb-4">
        <p className="text-sm text-muted-foreground">{t('admin.oauthClients.description')}</p>
      </div>

      {status === 'loading' && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
      {status === 'error' && <p className="text-sm text-destructive">{t('admin.oauthClients.loadError')}</p>}
      {status === 'ready' && clients.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('admin.oauthClients.empty')}</p>
      )}
      {status === 'ready' && clients.length > 0 && (
        <OAuthClientsTable clients={clients} pendingTokenId={pendingTokenId} onRevoke={handleRevoke} />
      )}
    </div>
  )
}
