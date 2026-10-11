import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { printWithLightDiagrams, setPrintMode, usePrintMode } from './print-mode'

describe('print mode', () => {
  afterEach(() => {
    setPrintMode(false)
    document.body.innerHTML = ''
  })

  it('notifies subscribers when the print mode changes', () => {
    const { result } = renderHook(() => usePrintMode())
    expect(result.current).toBe(false)

    act(() => setPrintMode(true))
    expect(result.current).toBe(true)
  })

  it('switches to print mode, waits for the diagrams to be redrawn, prints, then switches back', async () => {
    document.body.innerHTML = '<div data-print-pending></div>'
    const modes: boolean[] = []
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      modes.push(document.querySelector('[data-print-pending]') === null)
    })

    const printing = printWithLightDiagrams()
    expect(print).not.toHaveBeenCalled()
    document.body.innerHTML = ''
    await printing

    expect(print).toHaveBeenCalledTimes(1)
    expect(modes).toEqual([true])
    const { result } = renderHook(() => usePrintMode())
    expect(result.current).toBe(false)
  })
})
