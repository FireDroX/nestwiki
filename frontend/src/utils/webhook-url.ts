export type DetectedWebhookFormat = 'discord' | 'slack'

const DISCORD_HOSTS = new Set(['discord.com', 'discordapp.com', 'ptb.discord.com', 'canary.discord.com'])

function parseUrl(url: string): URL | null {
  try {
    return new URL(url.trim())
  } catch {
    return null
  }
}

export function detectWebhookFormat(url: string): DetectedWebhookFormat | null {
  const parsed = parseUrl(url)
  if (!parsed) return null
  const host = parsed.hostname.toLowerCase()
  if (DISCORD_HOSTS.has(host) && parsed.pathname.startsWith('/api/webhooks/')) return 'discord'
  if (host === 'hooks.slack.com') return 'slack'
  return null
}

export function webhookHost(url: string): string {
  return parseUrl(url)?.host ?? url
}

export function isHttpUrl(url: string): boolean {
  const parsed = parseUrl(url)
  return parsed !== null && (parsed.protocol === 'http:' || parsed.protocol === 'https:')
}
