import { RESERVED_ROOT_PAGE_SLUGS } from '#utils/slug'

const PAGE_PATH = /^\/pages(\/[^#?]*)/

function toInstancePath(href: string, origin: string): string | null {
  if (href.startsWith(`${origin}/`)) {
    return href.slice(origin.length)
  }
  return href.startsWith('/') && !href.startsWith('//') ? href : null
}

export function toLinkedPagePath(href: string, origin: string): string | null {
  const instancePath = toInstancePath(href, origin)
  const match = instancePath ? PAGE_PATH.exec(instancePath) : null
  if (!match) {
    return null
  }
  let path: string
  try {
    path = decodeURIComponent(match[1].replace(/\/+$/, '')).toLowerCase()
  } catch {
    return null
  }
  const [rootSlug] = path.split('/').filter(Boolean)
  return rootSlug && !RESERVED_ROOT_PAGE_SLUGS.includes(rootSlug) ? path : null
}
