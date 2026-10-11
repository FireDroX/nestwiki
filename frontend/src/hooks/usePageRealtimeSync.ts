import { useEffect, useRef } from 'react'
import { mergePreview, type MergePreviewResult } from '#api/pages'
import { getRealtimeSocket } from '#lib/realtime-client'
import { usePageRoom } from '#hooks/usePageRoom'

interface PageVersionCreatedPayload {
  pageId: string
}

export interface UsePageRealtimeSyncOptions {
  getBaseVersionId: () => string
  getContent: () => string
  onMergeResult: (result: MergePreviewResult) => void
}

export function usePageRealtimeSync(
  pageId: string | undefined,
  options: UsePageRealtimeSyncOptions,
): void {
  usePageRoom(pageId)

  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  useEffect(() => {
    if (!pageId) {
      return
    }

    const socket = getRealtimeSocket()
    let latestRequest = 0

    async function previewMerge(currentPageId: string) {
      const request = ++latestRequest
      const baseVersionId = optionsRef.current.getBaseVersionId()
      const content = optionsRef.current.getContent()

      try {
        const result = await mergePreview(currentPageId, { baseVersionId, content })
        if (request !== latestRequest) {
          return
        }
        const draftChanged =
          optionsRef.current.getBaseVersionId() !== baseVersionId || optionsRef.current.getContent() !== content
        if (draftChanged) {
          await previewMerge(currentPageId)
          return
        }
        optionsRef.current.onMergeResult(result)
      } catch (error) {
        console.error(error)
      }
    }

    function handleVersionCreated(payload: PageVersionCreatedPayload) {
      if (payload.pageId === pageId) {
        void previewMerge(pageId)
      }
    }

    socket.on('page:version-created', handleVersionCreated)
    return () => {
      socket.off('page:version-created', handleVersionCreated)
    }
  }, [pageId])
}
