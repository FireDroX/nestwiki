import { describe, expect, it } from 'vitest'
import { isPrintableContentReady } from './printable-content'

describe('isPrintableContentReady', () => {
  it('waits for pending diagrams and images', () => {
    const root = document.createElement('div')
    expect(isPrintableContentReady(root)).toBe(true)

    root.innerHTML = '<div data-print-pending></div>'
    expect(isPrintableContentReady(root)).toBe(false)

    root.innerHTML = '<img>'
    Object.defineProperty(root.querySelector('img'), 'complete', { value: false })
    expect(isPrintableContentReady(root)).toBe(false)
  })

  it('waits for web fonts still loading', () => {
    Object.defineProperty(document, 'fonts', { value: { status: 'loading' }, configurable: true })
    expect(isPrintableContentReady(document.createElement('div'))).toBe(false)
    Object.defineProperty(document, 'fonts', { value: { status: 'loaded' }, configurable: true })
    expect(isPrintableContentReady(document.createElement('div'))).toBe(true)
  })
})
