export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const RESERVED_ROOT_PAGE_SLUGS: readonly string[] = ['tree']
const RESERVED_CHILD_OF_ROOT_PAGE_SLUGS: readonly string[] = ['versions', 'comments', 'tags', 'access-rules', 'stats']

export function isReservedSlug(slug: string, depth: number): boolean {
  if (depth === 1) {
    return RESERVED_ROOT_PAGE_SLUGS.includes(slug)
  }
  if (depth === 2) {
    return RESERVED_CHILD_OF_ROOT_PAGE_SLUGS.includes(slug)
  }
  return false
}
