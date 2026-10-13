import { useCallback } from 'react'
import { usePageTree } from '#hooks/usePageTree'
import { buildPagePath } from '#utils/page-tree'
import { resolveLogTargetLink, type LogTarget } from '#utils/log-target-link'

export function useLogTargetLink(): (entry: LogTarget) => string | null {
  const { tree } = usePageTree()

  return useCallback(
    (entry: LogTarget) =>
      resolveLogTargetLink(entry, (pageId) => buildPagePath(tree, pageId)?.join('/') ?? null),
    [tree],
  )
}
