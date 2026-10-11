import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { printWithLightDiagrams, setPrintMode, usePrintMode, usePrintShortcut } from './print-mode'

describe('print mode', () => {
  afterEach(() => {
    setPrintMode(false)
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('notifies subscribers when the print mode changes', () => {
    const { result } = renderHook(() => usePrintMode())
    expect(result.current).toBe(false)

    act(() => setPrintMode(true))
    expect(result.current).toBe(true)
  })

  it('switches to print mode, waits for the diagrams to be redrawn, prints, and switches back once printing is over', async () => {
    document.body.innerHTML = '<div data-print-pending></div>'
    const readyWhenPrinted: boolean[] = []
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      readyWhenPrinted.push(document.querySelector('[data-print-pending]') === null)
    })
    const { result } = renderHook(() => usePrintMode())

    const printing = printWithLightDiagrams()
    expect(print).not.toHaveBeenCalled()
    document.body.innerHTML = ''
    await act(() => printing)

    expect(print).toHaveBeenCalledTimes(1)
    expect(readyWhenPrinted).toEqual([true])
    expect(result.current).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('afterprint'))
    })
    expect(result.current).toBe(false)
  })

  it('routes Ctrl+P and Cmd+P through the light-diagram print', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    renderHook(() => usePrintShortcut())

    const ctrlP = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, cancelable: true })
    window.dispatchEvent(ctrlP)
    expect(ctrlP.defaultPrevented).toBe(true)
    await vi.waitFor(() => expect(print).toHaveBeenCalledTimes(1))

    const plainP = new KeyboardEvent('keydown', { key: 'p', cancelable: true })
    window.dispatchEvent(plainP)
    expect(plainP.defaultPrevented).toBe(false)
  })
})
