import { useEffect, useState } from 'react'
import type { TocHeading } from '#utils/table-of-contents'

const READING_LINE_OFFSET_PX = 120
const BOTTOM_TOLERANCE_PX = 2

function toScrollContainer(target: EventTarget | null): Element | null {
  if (target instanceof Document) {
    return target.scrollingElement
  }
  return target instanceof Element ? target : null
}

function isScrolledToBottom(container: Element | null): boolean {
  if (!container) {
    return false
  }
  return container.scrollHeight - container.scrollTop - container.clientHeight <= BOTTOM_TOLERANCE_PX
}

function findActiveHeadingId(elements: HTMLElement[], scrolledToBottom: boolean): string | null {
  if (scrolledToBottom) {
    return elements.at(-1)?.id ?? null
  }
  const passed = elements.filter((element) => element.getBoundingClientRect().top <= READING_LINE_OFFSET_PX)
  return (passed.at(-1) ?? elements[0])?.id ?? null
}

export function useActiveHeading(headings: TocHeading[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => element !== null)
    if (elements.length === 0) {
      return
    }

    let frame = 0
    function update(event?: Event) {
      const container = toScrollContainer(event?.target ?? null)
      if (event?.type === 'scroll' && !container?.contains(elements[0])) {
        return
      }
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setActiveId(findActiveHeadingId(elements, isScrolledToBottom(container)))
      })
    }

    update()
    document.addEventListener('scroll', update, { capture: true, passive: true })
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('scroll', update, { capture: true })
      window.removeEventListener('resize', update)
    }
  }, [headings])

  return activeId
}
