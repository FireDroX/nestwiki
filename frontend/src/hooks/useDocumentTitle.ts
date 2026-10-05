import { useEffect } from 'react'

export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (!title) return
    const previousTitle = document.title
    document.title = `${title} - NestWiki`
    return () => {
      document.title = previousTitle
    }
  }, [title])
}
