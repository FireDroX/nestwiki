import { useEffect, useState } from 'react'
import type { TocHeading } from '#utils/table-of-contents'

const READING_ZONE_MARGIN = '0px 0px -70% 0px'

export function useActiveHeading(headings: TocHeading[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || headings.length === 0) {
      return
    }
    const headingIds = headings.map((heading) => heading.id)
    const elements = headingIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null)
    const visibleIds = new Set<string>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleIds.add(entry.target.id)
          } else {
            visibleIds.delete(entry.target.id)
          }
        }
        const firstVisibleId = headingIds.find((id) => visibleIds.has(id))
        if (firstVisibleId) {
          setActiveId(firstVisibleId)
        }
      },
      { rootMargin: READING_ZONE_MARGIN },
    )
    elements.forEach((element) => observer.observe(element))

    return () => observer.disconnect()
  }, [headings])

  return activeId
}
