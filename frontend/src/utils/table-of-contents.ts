export interface TocHeading {
  id: string
  text: string
  level: number
}

const TOC_MIN_HEADINGS = 2

const TOC_HEADING_SELECTOR = 'h1[id], h2[id], h3[id]'

export function collectTocHeadings(root: HTMLElement): TocHeading[] {
  return Array.from(root.querySelectorAll<HTMLHeadingElement>(TOC_HEADING_SELECTOR))
    .map((heading) => ({
      id: heading.id,
      text: heading.textContent?.trim() ?? '',
      level: Number(heading.tagName.slice(1)),
    }))
    .filter((heading) => heading.text !== '')
}

export function shouldShowTableOfContents(headings: TocHeading[]): boolean {
  return headings.length >= TOC_MIN_HEADINGS
}

export interface TocNode {
  heading: TocHeading
  children: TocNode[]
}

export function buildTocTree(headings: TocHeading[]): TocNode[] {
  const roots: TocNode[] = []
  const ancestors: TocNode[] = []

  for (const heading of headings) {
    const node: TocNode = { heading, children: [] }
    while (ancestors.length > 0 && ancestors[ancestors.length - 1].heading.level >= heading.level) {
      ancestors.pop()
    }
    const parent = ancestors[ancestors.length - 1]
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
    ancestors.push(node)
  }

  return roots
}
