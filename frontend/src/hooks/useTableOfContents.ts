import { type RefObject, useEffect, useState } from 'react'
import { collectTocHeadings, type TocHeading } from '#utils/table-of-contents'

export function useTableOfContents(containerRef: RefObject<HTMLElement | null>, content: string | undefined): TocHeading[] {
  const [headings, setHeadings] = useState<TocHeading[]>([])

  useEffect(() => {
    setHeadings(containerRef.current ? collectTocHeadings(containerRef.current) : [])
  }, [containerRef, content])

  return headings
}
