import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePageRealtimeSync } from './usePageRealtimeSync'

const handlers: Record<string, (payload: { pageId: string }) => void> = {}
const mockSocket = {
  emit: vi.fn(),
  on: vi.fn((event: string, handler: (payload: { pageId: string }) => void) => {
    handlers[event] = handler
  }),
  off: vi.fn(),
}

vi.mock('#lib/realtime-client', () => ({
  getRealtimeSocket: () => mockSocket,
}))

const mergePreviewMock = vi.fn()
vi.mock('#api/pages', () => ({
  mergePreview: (...args: unknown[]) => mergePreviewMock(...args),
}))

describe('usePageRealtimeSync', () => {
  beforeEach(() => {
    mockSocket.emit.mockClear()
    mockSocket.on.mockClear()
    mergePreviewMock.mockReset()
  })

  it('joins the page room on mount and leaves it on unmount', () => {
    const { unmount } = renderHook(() =>
      usePageRealtimeSync('page-1', {
        getBaseVersionId: () => 'version-1',
        getContent: () => 'my draft',
        onMergeResult: vi.fn(),
      }),
    )

    expect(mockSocket.emit).toHaveBeenCalledWith('page:join', { pageId: 'page-1' })

    unmount()

    expect(mockSocket.emit).toHaveBeenCalledWith('page:leave', { pageId: 'page-1' })
  })

  it('previews and reports a merge result when a version-created event arrives for this page', async () => {
    const onMergeResult = vi.fn()
    mergePreviewMock.mockResolvedValue({
      conflict: false,
      mergedContent: 'merged content',
      newBaseVersionId: 'version-2',
    })

    renderHook(() =>
      usePageRealtimeSync('page-1', {
        getBaseVersionId: () => 'version-1',
        getContent: () => 'my draft',
        onMergeResult,
      }),
    )

    handlers['page:version-created']({ pageId: 'page-1' })

    await waitFor(() => {
      expect(onMergeResult).toHaveBeenCalledWith({
        conflict: false,
        mergedContent: 'merged content',
        newBaseVersionId: 'version-2',
      })
    })
    expect(mergePreviewMock).toHaveBeenCalledWith('page-1', {
      baseVersionId: 'version-1',
      content: 'my draft',
    })
  })

  it('ignores version-created events for a different page', () => {
    const onMergeResult = vi.fn()

    renderHook(() =>
      usePageRealtimeSync('page-1', {
        getBaseVersionId: () => 'version-1',
        getContent: () => 'my draft',
        onMergeResult,
      }),
    )

    handlers['page:version-created']({ pageId: 'other-page' })

    expect(mergePreviewMock).not.toHaveBeenCalled()
  })

  it('retries with the current draft when it changed while the preview was in flight', async () => {
    const onMergeResult = vi.fn()
    let content = 'draft before apply'
    let baseVersionId = 'version-1'
    let resolveFirst: (value: unknown) => void = () => {}
    mergePreviewMock
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce({ conflict: false, mergedContent: 'resolved', newBaseVersionId: 'version-3' })

    renderHook(() =>
      usePageRealtimeSync('page-1', {
        getBaseVersionId: () => baseVersionId,
        getContent: () => content,
        onMergeResult,
      }),
    )

    handlers['page:version-created']({ pageId: 'page-1' })
    content = 'resolved'
    baseVersionId = 'version-2'
    resolveFirst({ conflict: false, mergedContent: 'stale merge', newBaseVersionId: 'version-3' })

    await waitFor(() => {
      expect(onMergeResult).toHaveBeenCalledWith({
        conflict: false,
        mergedContent: 'resolved',
        newBaseVersionId: 'version-3',
      })
    })
    expect(onMergeResult).toHaveBeenCalledTimes(1)
    expect(mergePreviewMock).toHaveBeenLastCalledWith('page-1', { baseVersionId: 'version-2', content: 'resolved' })
  })

  it('only reports the result of the latest event when previews overlap', async () => {
    const onMergeResult = vi.fn()
    let resolveFirst: (value: unknown) => void = () => {}
    mergePreviewMock
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce({ conflict: false, mergedContent: 'latest', newBaseVersionId: 'version-3' })

    renderHook(() =>
      usePageRealtimeSync('page-1', {
        getBaseVersionId: () => 'version-1',
        getContent: () => 'my draft',
        onMergeResult,
      }),
    )

    handlers['page:version-created']({ pageId: 'page-1' })
    handlers['page:version-created']({ pageId: 'page-1' })
    await waitFor(() => expect(onMergeResult).toHaveBeenCalledTimes(1))
    resolveFirst({ conflict: false, mergedContent: 'older', newBaseVersionId: 'version-2' })
    await Promise.resolve()

    expect(onMergeResult).toHaveBeenCalledTimes(1)
    expect(onMergeResult).toHaveBeenCalledWith(expect.objectContaining({ mergedContent: 'latest' }))
  })
})
