import { useEffect, useSyncExternalStore } from 'react'
import { isPrintableContentReady } from '#utils/printable-content'

const READY_CHECK_INTERVAL_MS = 100
const READY_TIMEOUT_MS = 5000
const MENU_CLOSE_DELAY_MS = 300

let printMode = false
const listeners = new Set<() => void>()

export function setPrintMode(enabled: boolean): void {
  if (printMode === enabled) {
    return
  }
  printMode = enabled
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePrintMode(): boolean {
  return useSyncExternalStore(subscribe, () => printMode)
}

function waitForPrintableContent(): Promise<void> {
  const startedAt = Date.now()
  return new Promise((resolve) => {
    const check = () => {
      if (isPrintableContentReady(document.body) || Date.now() - startedAt > READY_TIMEOUT_MS) {
        resolve()
      } else {
        window.setTimeout(check, READY_CHECK_INTERVAL_MS)
      }
    }
    window.setTimeout(check, MENU_CLOSE_DELAY_MS)
  })
}

export async function printWithLightDiagrams(): Promise<void> {
  setPrintMode(true)
  window.addEventListener('afterprint', () => setPrintMode(false), { once: true })
  await waitForPrintableContent()
  window.print()
}

function isPrintShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'p'
}

export function usePrintShortcut(): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isPrintShortcut(event)) {
        event.preventDefault()
        void printWithLightDiagrams()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
