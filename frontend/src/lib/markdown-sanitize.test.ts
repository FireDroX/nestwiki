import { describe, expect, it } from 'vitest'
import type { Element, Root } from 'hast'
import { rehypeHardenFullMode } from './markdown-sanitize'

describe('rehypeHardenFullMode', () => {
  it('deletes the onClick property but keeps other properties untouched', () => {
    const div: Element = {
      type: 'element',
      tagName: 'div',
      properties: { onClick: 'evil()', className: ['foo'] },
      children: [],
    }
    const tree: Root = { type: 'root', children: [div] }

    rehypeHardenFullMode()(tree)

    const [node] = tree.children as Element[]
    expect(node.properties.onClick).toBeUndefined()
    expect(node.properties.className).toEqual(['foo'])
  })

  it('removes SVG animation tags whatever their case, and dangerous values of any property', () => {
    const element = (tagName: string, properties: Element['properties'] = {}): Element => ({
      type: 'element',
      tagName,
      properties,
      children: [],
    })
    const link = element('a', { xLinkHref: 'javascript:alert(1)', title: 'ok', dataUrl: [' javascript:x'] })
    link.children = [element('set', { to: 'javascript:alert(1)' }), element('animateMotion'), element('text')]
    const tree: Root = { type: 'root', children: [link] }

    rehypeHardenFullMode()(tree)

    const [node] = tree.children as Element[]
    expect(node.properties).toEqual({ title: 'ok' })
    expect((node.children as Element[]).map((child) => child.tagName)).toEqual(['text'])
  })

  it('removes a denylisted nested tag while keeping the parent and its other children', () => {
    const iframe: Element = {
      type: 'element',
      tagName: 'iframe',
      properties: { src: '//nested' },
      children: [],
    }
    const text = { type: 'text' as const, value: 'hi' }
    const div: Element = {
      type: 'element',
      tagName: 'div',
      properties: {},
      children: [text, iframe],
    }
    const tree: Root = { type: 'root', children: [div] }

    rehypeHardenFullMode()(tree)

    const [node] = tree.children as Element[]
    expect(node.tagName).toBe('div')
    expect(node.children).toHaveLength(1)
    expect(node.children[0]).toBe(text)
  })
})
