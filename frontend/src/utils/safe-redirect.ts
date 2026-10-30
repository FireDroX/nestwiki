export function sameOriginPath(raw: string | null, origin: string = window.location.origin): string | null {
  if (!raw) {
    return null
  }
  let url: URL
  try {
    url = new URL(raw, origin)
  } catch {
    return null
  }
  return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : null
}
