import { useSyncExternalStore } from 'react'
import { isPrintableContentReady } from '#utils/printable-content'

const READY_CHECK_INTERVAL_MS = 100
const READY_TIMEOUT_MS = 5000

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
    const timer = window.setInterval(() => {
      if (isPrintableContentReady(document.body) || Date.now() - startedAt > READY_TIMEOUT_MS) {
        window.clearInterval(timer)
        resolve()
      }
    }, READY_CHECK_INTERVAL_MS)
  })
}

export async function printWithLightDiagrams(): Promise<void> {
  setPrintMode(true)
  try {
    await waitForPrintableContent()
    window.print()
  } finally {
    setPrintMode(false)
  }
}
