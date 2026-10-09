import { afterEach, describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useActiveHeading } from './useActiveHeading'

const HEADINGS = [
  { id: 'intro', text: 'Intro', level: 2 },
  { id: 'usage', text: 'Usage', level: 2 },
  { id: 'faq', text: 'FAQ', level: 2 },
]

function mountHeadings(tops: number[]): HTMLElement {
  const container = document.createElement('div')
  HEADINGS.forEach((heading, index) => {
    const element = document.createElement('h2')
    element.id = heading.id
    element.getBoundingClientRect = () => ({ top: tops[index] }) as DOMRect
    container.appendChild(element)
  })
  Object.defineProperty(container, 'scrollHeight', { value: 5000 })
  Object.defineProperty(container, 'clientHeight', { value: 500 })
  document.body.appendChild(container)
  return container
}

describe('useActiveHeading', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('starts on the first heading when none has reached the reading line', async () => {
    mountHeadings([300, 800, 1400])
    const { result } = renderHook(() => useActiveHeading(HEADINGS))
    await waitFor(() => expect(result.current).toBe('intro'))
  })

  it('tracks the last heading scrolled past the reading line', async () => {
    const container = mountHeadings([-500, 40, 600])
    const { result } = renderHook(() => useActiveHeading(HEADINGS))
    await waitFor(() => expect(result.current).toBe('usage'))

    const faq = document.getElementById('faq') as HTMLElement
    faq.getBoundingClientRect = () => ({ top: 100 }) as DOMRect
    act(() => {
      container.dispatchEvent(new Event('scroll'))
    })
    await waitFor(() => expect(result.current).toBe('faq'))
  })

  it('selects the last heading once the container is scrolled to the bottom', async () => {
    const container = mountHeadings([-500, 40, 600])
    const { result } = renderHook(() => useActiveHeading(HEADINGS))
    await waitFor(() => expect(result.current).toBe('usage'))

    container.scrollTop = 4500
    act(() => {
      container.dispatchEvent(new Event('scroll'))
    })
    await waitFor(() => expect(result.current).toBe('faq'))
  })
})
