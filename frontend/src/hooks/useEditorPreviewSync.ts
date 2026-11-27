import { type RefObject, useEffect, useRef } from 'react'
import {
  type AnchorElement,
  collectAnchorElements,
  measureAnchors,
  previewOffsetForLine,
  sourceLineAtOffset,
} from '#lib/editor-preview-sync'
import {
  alignVisibleText,
  blockSourceSlice,
  caretPositionFromValue,
  findContainingAnchorIndex,
  visibleSourceText,
} from '#lib/markdown-caret-mapping'
import { SOURCE_LINE_ATTRIBUTE } from '#lib/markdown-source-lines'

const BOTTOM_TOLERANCE_PX = 2
const CARET_MARGIN_PX = 24
const CARET_LEFT_GAP_PX = 6
const CARET_HALF_WIDTH_PX = 1
const DEFAULT_LINE_HEIGHT_PX = 22
const MIRRORED_STYLES = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'tabSize',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
] as const

interface UseEditorPreviewSyncOptions {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  previewRef: RefObject<HTMLElement | null>
  caretRef: RefObject<HTMLElement | null>
  enabled: boolean
  content: string
}

interface CaretBox {
  left: number
  top: number
  height: number
}

interface LineTopsCache {
  value: string
  width: number
  tops: number[]
}

function measureLineTops(textarea: HTMLTextAreaElement): LineTopsCache {
  const value = textarea.value
  const width = textarea.clientWidth
  const computed = getComputedStyle(textarea)
  const mirror = document.createElement('div')
  mirror.setAttribute('aria-hidden', 'true')
  for (const property of MIRRORED_STYLES) {
    mirror.style[property] = computed[property]
  }
  Object.assign(mirror.style, {
    position: 'absolute',
    visibility: 'hidden',
    top: '0',
    left: '-9999px',
    boxSizing: 'border-box',
    width: `${width}px`,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
  })
  const fragment = document.createDocumentFragment()
  for (const line of value.split('\n')) {
    const row = document.createElement('div')
    row.textContent = line === '' ? ' ' : line
    fragment.appendChild(row)
  }
  mirror.appendChild(fragment)
  document.body.appendChild(mirror)
  const tops = Array.from(mirror.children, (row) => (row as HTMLElement).offsetTop)
  tops.push(mirror.scrollHeight)
  mirror.remove()
  return { value, width, tops }
}

function collectOwnTextNodes(block: HTMLElement): Text[] {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const owner = node.parentElement?.closest(`[${SOURCE_LINE_ATTRIBUTE}]`)
    if (node.data.length > 0 && owner === block) {
      nodes.push(node)
    }
  }
  return nodes
}

function characterEdge(node: Text, offset: number): { x: number; top: number; height: number } | null {
  const range = document.createRange()
  const atStart = offset <= 0
  range.setStart(node, atStart ? 0 : offset - 1)
  range.setEnd(node, atStart ? Math.min(1, node.length) : offset)
  const rects = range.getClientRects()
  if (rects.length === 0) {
    return null
  }
  const rect = atStart ? rects[0] : rects[rects.length - 1]
  return rect.height > 0 ? { x: atStart ? rect.left : rect.right, top: rect.top, height: rect.height } : null
}

function previewLineHeight(preview: HTMLElement): number {
  const parsed = parseFloat(getComputedStyle(preview).lineHeight)
  return Number.isFinite(parsed) ? parsed : DEFAULT_LINE_HEIGHT_PX
}

export function useEditorPreviewSync({ textareaRef, previewRef, caretRef, enabled, content }: UseEditorPreviewSyncOptions) {
  const invalidateAnchorsRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    const preview = previewRef.current
    const caret = caretRef.current
    if (!enabled || !textarea || !preview || !caret) {
      return
    }

    let frame = 0
    let scrollPending = false
    let caretPending = false
    let anchorElements: AnchorElement[] | null = null
    let lineTopsCache: LineTopsCache | null = null

    function getAnchorElements(): AnchorElement[] {
      anchorElements ??= collectAnchorElements(preview!)
      return anchorElements
    }

    function getLineTops(): number[] {
      const stale =
        !lineTopsCache || lineTopsCache.value !== textarea!.value || lineTopsCache.width !== textarea!.clientWidth
      if (stale) {
        lineTopsCache = measureLineTops(textarea!)
      }
      return lineTopsCache!.tops
    }

    function hideCaret() {
      caret!.removeAttribute('data-visible')
    }

    function syncScroll() {
      const maxPreviewScroll = preview!.scrollHeight - preview!.clientHeight
      const { scrollTop, clientHeight, scrollHeight } = textarea!
      if (scrollTop <= 0) {
        preview!.scrollTop = 0
        return
      }
      if (scrollHeight - scrollTop - clientHeight <= BOTTOM_TOLERANCE_PX) {
        preview!.scrollTop = maxPreviewScroll
        return
      }
      const topLine = sourceLineAtOffset(getLineTops(), scrollTop)
      const anchors = measureAnchors(preview!, getAnchorElements())
      preview!.scrollTop = Math.min(previewOffsetForLine(anchors, topLine), maxPreviewScroll)
    }

    function blockLeftOffset(block: HTMLElement | null): number {
      const previewRect = preview!.getBoundingClientRect()
      const edge = block
        ? block.getBoundingClientRect().left - previewRect.left + preview!.scrollLeft
        : parseFloat(getComputedStyle(preview!).paddingLeft)
      return Math.max(0, edge - CARET_LEFT_GAP_PX)
    }

    function blockFallbackPosition(block: HTMLElement | null, line: number): CaretBox {
      const anchors = measureAnchors(preview!, getAnchorElements())
      return {
        left: blockLeftOffset(block),
        top: previewOffsetForLine(anchors, line),
        height: previewLineHeight(preview!),
      }
    }

    function characterPosition(entry: AnchorElement, line: number, column: number): CaretBox | null {
      const nodes = collectOwnTextNodes(entry.element)
      const slice = blockSourceSlice(textarea!.value, entry.line, line, column)
      const match = alignVisibleText(
        nodes.map((node) => node.data),
        visibleSourceText(slice),
      )
      if (!match) {
        return null
      }
      const edge = characterEdge(nodes[match.segment], match.offset)
      if (!edge) {
        return null
      }
      const previewRect = preview!.getBoundingClientRect()
      return {
        left: Math.max(0, edge.x - previewRect.left + preview!.scrollLeft - CARET_HALF_WIDTH_PX),
        top: edge.top - previewRect.top + preview!.scrollTop,
        height: edge.height,
      }
    }

    function computeCaretBox(): CaretBox {
      const { line, column } = caretPositionFromValue(textarea!.value, textarea!.selectionStart)
      const entries = getAnchorElements()
      const index = findContainingAnchorIndex(entries, line)
      if (index < 0) {
        return blockFallbackPosition(null, line)
      }
      return characterPosition(entries[index], line, column) ?? blockFallbackPosition(entries[index].element, line)
    }

    function updateCaret() {
      if (document.activeElement !== textarea) {
        hideCaret()
        return
      }
      const { left, top, height: lineHeight } = computeCaretBox()

      caret!.style.transform = `translate(${left}px, ${top}px)`
      caret!.style.height = `${lineHeight}px`
      caret!.setAttribute('data-visible', 'true')

      const visibleTop = preview!.scrollTop
      const visibleBottom = visibleTop + preview!.clientHeight
      if (top < visibleTop + CARET_MARGIN_PX) {
        preview!.scrollTop = Math.max(0, top - CARET_MARGIN_PX)
      } else if (top + lineHeight > visibleBottom - CARET_MARGIN_PX) {
        preview!.scrollTop = top + lineHeight + CARET_MARGIN_PX - preview!.clientHeight
      }
    }

    function flush() {
      frame = 0
      if (scrollPending) {
        scrollPending = false
        syncScroll()
      }
      if (caretPending) {
        caretPending = false
        updateCaret()
      }
    }

    function schedule() {
      if (frame === 0) {
        frame = requestAnimationFrame(flush)
      }
    }

    function onScroll() {
      scrollPending = true
      schedule()
    }

    function onCaretMove() {
      caretPending = true
      schedule()
    }

    function onSelectionChange() {
      if (document.activeElement === textarea) {
        onCaretMove()
      }
    }

    function onBlur() {
      caretPending = false
      hideCaret()
    }

    function onResize() {
      lineTopsCache = null
      scrollPending = true
      schedule()
    }

    invalidateAnchorsRef.current = () => {
      anchorElements = null
      onCaretMove()
    }

    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(textarea)

    textarea.addEventListener('scroll', onScroll, { passive: true })
    for (const eventName of ['input', 'focus', 'click', 'keyup'] as const) {
      textarea.addEventListener(eventName, onCaretMove)
    }
    textarea.addEventListener('blur', onBlur)
    document.addEventListener('selectionchange', onSelectionChange)

    onCaretMove()

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      textarea.removeEventListener('scroll', onScroll)
      for (const eventName of ['input', 'focus', 'click', 'keyup'] as const) {
        textarea.removeEventListener(eventName, onCaretMove)
      }
      textarea.removeEventListener('blur', onBlur)
      document.removeEventListener('selectionchange', onSelectionChange)
      invalidateAnchorsRef.current = null
      hideCaret()
    }
  }, [enabled, textareaRef, previewRef, caretRef])

  useEffect(() => {
    invalidateAnchorsRef.current?.()
  }, [content])
}
