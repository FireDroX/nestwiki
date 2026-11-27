import { type RefObject, useEffect, useRef } from 'react'
import {
  type AnchorElement,
  caretLineFromValue,
  collectAnchorElements,
  measureAnchors,
  previewOffsetForLine,
  sourceLineAtOffset,
} from '#lib/editor-preview-sync'

const BOTTOM_TOLERANCE_PX = 2
const CARET_MARGIN_PX = 24
const CARET_LEFT_GAP_PX = 6
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

    function updateCaret() {
      if (document.activeElement !== textarea) {
        hideCaret()
        return
      }
      const line = caretLineFromValue(textarea!.value, textarea!.selectionStart)
      const anchors = measureAnchors(preview!, getAnchorElements())
      const lineHeight = previewLineHeight(preview!)
      const top = previewOffsetForLine(anchors, line)
      const left = Math.max(0, parseFloat(getComputedStyle(preview!).paddingLeft) - CARET_LEFT_GAP_PX)

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
