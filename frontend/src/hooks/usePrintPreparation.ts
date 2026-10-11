import { useEffect, useRef } from 'react'

const DARK_THEME_CLASS = 'dark'
const HEADER_STYLE_ATTRIBUTE = 'data-print-header'
const HEADER_BOX_STYLE = 'font-size: 9pt; color: #555;'

function cssString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`
}

function buildHeaderCss(printedBy: string | undefined): string {
  const date = new Date().toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  const boxes = [
    `@top-left { content: ${cssString(date)}; ${HEADER_BOX_STYLE} }`,
    `@top-center { content: ${cssString(document.title)}; ${HEADER_BOX_STYLE} }`,
    printedBy ? `@top-right { content: ${cssString(printedBy)}; ${HEADER_BOX_STYLE} }` : '',
    `@bottom-right { content: counter(page) " / " counter(pages); ${HEADER_BOX_STYLE} }`,
  ]
  return `@page { ${boxes.filter(Boolean).join(' ')} }`
}

export function usePrintPreparation(printedBy?: string): void {
  const printedByRef = useRef(printedBy)
  useEffect(() => {
    printedByRef.current = printedBy
  })

  useEffect(() => {
    let openedForPrint: HTMLDetailsElement[] = []
    let wasDark = false
    let headerStyle: HTMLStyleElement | null = null

    function prepare() {
      openedForPrint = [...document.querySelectorAll('details')].filter((details) => !details.open)
      openedForPrint.forEach((details) => {
        details.open = true
      })
      wasDark = document.documentElement.classList.contains(DARK_THEME_CLASS)
      document.documentElement.classList.remove(DARK_THEME_CLASS)
      headerStyle = document.createElement('style')
      headerStyle.setAttribute(HEADER_STYLE_ATTRIBUTE, '')
      headerStyle.textContent = buildHeaderCss(printedByRef.current)
      document.head.appendChild(headerStyle)
    }

    function restore() {
      openedForPrint.forEach((details) => {
        details.open = false
      })
      openedForPrint = []
      if (wasDark) {
        document.documentElement.classList.add(DARK_THEME_CLASS)
      }
      headerStyle?.remove()
      headerStyle = null
    }

    window.addEventListener('beforeprint', prepare)
    window.addEventListener('afterprint', restore)
    return () => {
      window.removeEventListener('beforeprint', prepare)
      window.removeEventListener('afterprint', restore)
      headerStyle?.remove()
    }
  }, [])
}
