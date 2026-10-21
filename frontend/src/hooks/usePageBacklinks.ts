import { useEffect, useState } from 'react'
import { getBacklinks, type PageBacklink } from '#api/pages'

export function usePageBacklinks(pageId: string): PageBacklink[] {
  const [backlinks, setBacklinks] = useState<PageBacklink[]>([])

  useEffect(() => {
    let cancelled = false
    getBacklinks(pageId)
      .then((result) => {
        if (!cancelled) setBacklinks(result)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [pageId])

  return backlinks
}
