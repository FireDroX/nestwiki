import { visit } from 'unist-util-visit'
import type { Element, ElementContent, Root } from 'hast'

const HEADING_TAG_NAMES = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

const NON_SLUG_CHARACTERS = /[^\p{L}\p{M}\p{N}\p{Pc} -]/gu

export function toHeadingSlug(text: string): string {
  return text.trim().toLowerCase().replace(NON_SLUG_CHARACTERS, '').replace(/ /g, '-')
}

function toPlainText(node: ElementContent): string {
  if (node.type === 'text') {
    return node.value
  }
  if (node.type === 'element') {
    return node.children.map(toPlainText).join('')
  }
  return ''
}

export class HeadingSlugger {
  private readonly taken = new Set<string>()

  reserve(id: string): void {
    this.taken.add(id)
  }

  slug(text: string): string {
    const base = toHeadingSlug(text)
    if (base === '') {
      return ''
    }
    let candidate = base
    let suffix = 0
    while (this.taken.has(candidate)) {
      suffix += 1
      candidate = `${base}-${suffix}`
    }
    this.taken.add(candidate)
    return candidate
  }
}

function isHeading(node: Element): boolean {
  return HEADING_TAG_NAMES.has(node.tagName)
}

export function rehypeHeadingIds() {
  return (tree: Root) => {
    const slugger = new HeadingSlugger()
    const headingsWithoutId: Element[] = []

    visit(tree, 'element', (node: Element) => {
      if (!isHeading(node)) {
        return
      }
      const existingId = node.properties?.id
      if (typeof existingId === 'string' && existingId !== '') {
        slugger.reserve(existingId)
      } else {
        headingsWithoutId.push(node)
      }
    })

    for (const heading of headingsWithoutId) {
      const slug = slugger.slug(heading.children.map(toPlainText).join(''))
      if (slug !== '') {
        heading.properties = { ...heading.properties, id: slug }
      }
    }
  }
}

const GENERATED_ID = /^(user-content-|footnote-label$)/

function isGeneratedAnchor(node: Element, id: string): boolean {
  return isHeading(node) || GENERATED_ID.test(id)
}

export function rehypePrefixAnchors(prefix: string) {
  return (tree: Root) => {
    const prefixed = new Set<string>()
    visit(tree, 'element', (node: Element) => {
      const id = node.properties?.id
      if (typeof id === 'string' && id !== '' && isGeneratedAnchor(node, id)) {
        prefixed.add(id)
        node.properties.id = `${prefix}${id}`
      }
    })
    visit(tree, 'element', (node: Element) => {
      const { href, ariaDescribedBy } = node.properties ?? {}
      if (typeof href === 'string' && href.startsWith('#') && prefixed.has(href.slice(1))) {
        node.properties.href = `#${prefix}${href.slice(1)}`
      }
      if (Array.isArray(ariaDescribedBy)) {
        node.properties.ariaDescribedBy = ariaDescribedBy.map((reference) =>
          prefixed.has(String(reference)) ? `${prefix}${String(reference)}` : reference,
        )
      }
    })
  }
}
