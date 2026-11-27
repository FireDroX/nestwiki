import { useCallback, useState } from 'react'

function readCollapsed(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) === 'true'
  } catch {
    return false
  }
}

function rememberCollapsed(storageKey: string, collapsed: boolean) {
  try {
    localStorage.setItem(storageKey, String(collapsed))
  } catch {
    return
  }
}

export function usePersistedCollapsed(storageKey: string) {
  const [collapsed, setCollapsedState] = useState(() => readCollapsed(storageKey))

  const setCollapsed = useCallback(
    (next: boolean) => {
      setCollapsedState(next)
      rememberCollapsed(storageKey, next)
    },
    [storageKey],
  )

  return { collapsed, setCollapsed }
}
