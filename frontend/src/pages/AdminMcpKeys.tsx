import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { AdminNav } from '#components/AdminNav'
import { ApiKeyRevealDialog } from '#components/AdminMcpKeys/ApiKeyRevealDialog'
import { CreateApiKeyDialog } from '#components/AdminMcpKeys/CreateApiKeyDialog'
import { McpApiKeysTable } from '#components/AdminMcpKeys/McpApiKeysTable'
import { listApiKeys, revokeApiKey, type McpApiKeyCreated, type McpApiKeySummary } from '#api/admin-mcp'
import { extractErrorMessage } from '#lib/api-errors'
import { PAGE_PADDING } from '#utils/page-layout'

type Status = 'loading' | 'ready' | 'error'

export function AdminMcpKeys() {
  const { t } = useTranslation()
  const [keys, setKeys] = useState<McpApiKeySummary[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [pendingKeyId, setPendingKeyId] = useState<string | null>(null)
  const [revealedKey, setRevealedKey] = useState<McpApiKeyCreated | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setStatus('loading')
      try {
        const result = await listApiKeys()
        if (cancelled) return
        setKeys(result)
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

  function handleCreated(created: McpApiKeyCreated) {
    setKeys((current) => [
      { id: created.id, name: created.name, scopes: created.scopes, lastUsedAt: null, revokedAt: null, createdAt: created.createdAt },
      ...current,
    ])
    setRevealedKey(created)
  }

  async function handleRevoke(key: McpApiKeySummary) {
    setPendingKeyId(key.id)
    try {
      await revokeApiKey(key.id)
      setKeys((current) =>
        current.map((item) => (item.id === key.id ? { ...item, revokedAt: new Date().toISOString() } : item)),
      )
      toast.success(t('admin.mcpKeys.revoked'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('admin.mcpKeys.revokeFailed')))
    } finally {
      setPendingKeyId(null)
    }
  }

  return (
    <div className={PAGE_PADDING}>
      <AdminNav />
      <div className="mt-5 mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t('admin.mcpKeys.description')}</p>
        <CreateApiKeyDialog onCreated={handleCreated} />
      </div>

      {status === 'loading' && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
      {status === 'error' && <p className="text-sm text-destructive">{t('admin.mcpKeys.loadError')}</p>}
      {status === 'ready' && <McpApiKeysTable keys={keys} pendingKeyId={pendingKeyId} onRevoke={handleRevoke} />}

      <ApiKeyRevealDialog apiKey={revealedKey} onClose={() => setRevealedKey(null)} />
    </div>
  )
}
