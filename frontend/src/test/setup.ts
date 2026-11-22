import '@testing-library/jest-dom/vitest'
import '#lib/i18n'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

// jsdom doesn't implement these, and Radix primitives (Collapsible,
// Command/cmdk, ...) reach for them when measuring/scrolling layout.
// `window`/`Element` already declare them in lib.dom.d.ts (real
// browsers have them), so a runtime `in` guard would narrow to `never`
// under tsc — assign unconditionally instead, harmless in a real
// browser since it would just replace them with equivalent no-ops.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

window.matchMedia ??=
  ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia

Element.prototype.scrollIntoView ??= () => {}

// shiki's inlined WASM loader calls Blob#stream(), which jsdom lacks.
Blob.prototype.stream ??= function (this: Blob) {
  const bytes = this.arrayBuffer().then((buffer) => new Uint8Array(buffer as ArrayBuffer))
  return new ReadableStream<Uint8Array<ArrayBuffer>>({
    async start(controller) {
      controller.enqueue(await bytes)
      controller.close()
    },
  })
}
