import { visit, SKIP } from 'unist-util-visit'
import type { Element, Root } from 'hast'

const DENIED_TAG_NAMES = new Set([
  'script',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'form',
  'base',
  'link',
  'meta',
  'set',
  'animate',
  'animatemotion',
  'animatetransform',
  'animatecolor',
  'discard',
])

const DANGEROUS_PROTOCOLS = ['javascript:', 'vbscript:', 'data:text/html']

function isEventHandlerProperty(name: string): boolean {
  return /^on/i.test(name)
}

function hasDangerousProtocol(value: string): boolean {
  // eslint-disable-next-line no-control-regex
  const normalized = value.replace(/[\u0000- ]/g, '').toLowerCase()
  return DANGEROUS_PROTOCOLS.some((protocol) => normalized.startsWith(protocol))
}

function isDangerousValue(value: unknown): boolean {
  if (typeof value === 'string') {
    return hasDangerousProtocol(value)
  }
  return Array.isArray(value) && value.some((item) => typeof item === 'string' && hasDangerousProtocol(item))
}

export function rehypeHardenFullMode() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (DENIED_TAG_NAMES.has(node.tagName.toLowerCase()) && parent && typeof index === 'number') {
        parent.children.splice(index, 1)
        return [SKIP, index] as const
      }

      const properties = node.properties ?? {}
      for (const propertyName of Object.keys(properties)) {
        if (isEventHandlerProperty(propertyName) || isDangerousValue(properties[propertyName])) {
          delete properties[propertyName]
        }
      }
    })
  }
}
