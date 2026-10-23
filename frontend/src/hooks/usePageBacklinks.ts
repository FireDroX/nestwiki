import { useEffect, useState } from 'react'
import { getBacklinks, type PageBacklink } from '#api/pages'

interface UsePageBacklinksOptions {
  subtree?: boolean
  refreshKey?: number
}

export function usePageBacklinks(
  pageId: string | undefined,
  { subtree = false, refreshKey = 0 }: UsePageBacklinksOptions = {},
): PageBacklink[] {
  const [backlinks, setBacklinks] = useState<PageBacklink[]>([])

  useEffect(() => {
    if (!pageId) {
      return
    }
    let cancelled = false
    getBacklinks(pageId, { subtree })
      .then((result) => {
        if (!cancelled) setBacklinks(result)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [pageId, subtree, refreshKey])

  return backlinks
}
