import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePrintPreparation } from './usePrintPreparation'

describe('usePrintPreparation', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.documentElement.classList.remove('dark')
  })

  it('opens every collapsed section for printing and restores them afterwards', () => {
    document.body.innerHTML = '<details id="closed"></details><details id="open" open></details>'
    renderHook(() => usePrintPreparation())
    const closed = document.getElementById('closed') as HTMLDetailsElement
    const open = document.getElementById('open') as HTMLDetailsElement

    window.dispatchEvent(new Event('beforeprint'))
    expect(closed.open).toBe(true)
    expect(open.open).toBe(true)

    window.dispatchEvent(new Event('afterprint'))
    expect(closed.open).toBe(false)
    expect(open.open).toBe(true)
  })

  it('prints in the light theme and restores the dark theme afterwards', () => {
    document.documentElement.classList.add('dark')
    renderHook(() => usePrintPreparation())

    window.dispatchEvent(new Event('beforeprint'))
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    window.dispatchEvent(new Event('afterprint'))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
