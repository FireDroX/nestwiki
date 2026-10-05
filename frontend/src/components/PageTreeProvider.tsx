import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { getTree } from '#api/pages'
import type { PageTreeNode } from '#api/pages'
import { getRealtimeSocket } from '#lib/realtime-client'
import { useAuth } from '#hooks/useAuth'
import { PageTreeContext, type PageTreeStatus } from '#hooks/usePageTree'

export function PageTreeProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, user } = useAuth()
  const userId = user?.id
  const [tree, setTree] = useState<PageTreeNode[]>([])
  const [status, setStatus] = useState<PageTreeStatus>('loading')

  const refresh = useCallback(async () => {
    try {
      const nodes = await getTree()
      setTree(nodes)
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (authStatus === 'loading') {
      return
    }
    void refresh()
  }, [authStatus, userId, refresh])

  useEffect(() => {
    const socket = getRealtimeSocket()
    socket.on('page-tree:changed', refresh)
    return () => {
      socket.off('page-tree:changed', refresh)
    }
  }, [refresh])

  return <PageTreeContext.Provider value={{ tree, status, refresh }}>{children}</PageTreeContext.Provider>
}
