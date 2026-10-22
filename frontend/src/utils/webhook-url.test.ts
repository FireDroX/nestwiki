import { describe, expect, it } from 'vitest'
import { detectWebhookFormat, isHttpUrl, webhookHost } from './webhook-url'

describe('detectWebhookFormat', () => {
  it.each([
    ['https://discord.com/api/webhooks/123/abc', 'discord'],
    ['https://discordapp.com/api/webhooks/123/abc', 'discord'],
    ['https://hooks.slack.com/services/T0/B0/xyz', 'slack'],
  ])('recognises %s', (url, format) => {
    expect(detectWebhookFormat(url)).toBe(format)
  })

  it.each(['https://discord.com/channels/1/2', 'http://192.168.1.20:5678/webhook/wiki', 'not a url', ''])(
    'proposes nothing for %s',
    (url) => {
      expect(detectWebhookFormat(url)).toBeNull()
    },
  )
})

describe('webhookHost', () => {
  it('keeps the host and port only', () => {
    expect(webhookHost('http://192.168.1.20:5678/webhook/wiki?x=1')).toBe('192.168.1.20:5678')
  })

  it('falls back to the raw value when it is not a URL', () => {
    expect(webhookHost('oops')).toBe('oops')
  })
})

describe('isHttpUrl', () => {
  it('accepts http and https only', () => {
    expect(isHttpUrl('https://example.com/hook')).toBe(true)
    expect(isHttpUrl('http://n8n.local/hook')).toBe(true)
    expect(isHttpUrl('ftp://example.com')).toBe(false)
    expect(isHttpUrl('example.com')).toBe(false)
  })
})
