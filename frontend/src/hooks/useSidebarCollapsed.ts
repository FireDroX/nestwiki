import { useCallback, useState } from 'react'

export const SIDEBAR_COLLAPSED_KEY = 'nestwiki:sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

function rememberCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed))
  } catch {
    return
  }
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(readCollapsed)

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next)
    rememberCollapsed(next)
  }, [])

  return { collapsed, setCollapsed }
}
