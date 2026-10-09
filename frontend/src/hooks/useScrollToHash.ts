import { useEffect } from 'react'
import { useLocation } from 'react-router'

function decodeHash(hash: string): string {
  try {
    return decodeURIComponent(hash.slice(1))
  } catch {
    return hash.slice(1)
  }
}

export function useScrollToHash(content: string | undefined) {
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash || content === undefined) {
      return
    }
    document.getElementById(decodeHash(hash))?.scrollIntoView()
  }, [hash, content])
}
