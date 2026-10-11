import { useEffect } from 'react'

const DARK_THEME_CLASS = 'dark'

export function usePrintPreparation(): void {
  useEffect(() => {
    let openedForPrint: HTMLDetailsElement[] = []
    let wasDark = false

    function prepare() {
      openedForPrint = [...document.querySelectorAll('details')].filter((details) => !details.open)
      openedForPrint.forEach((details) => {
        details.open = true
      })
      wasDark = document.documentElement.classList.contains(DARK_THEME_CLASS)
      document.documentElement.classList.remove(DARK_THEME_CLASS)
    }

    function restore() {
      openedForPrint.forEach((details) => {
        details.open = false
      })
      openedForPrint = []
      if (wasDark) {
        document.documentElement.classList.add(DARK_THEME_CLASS)
      }
    }

    window.addEventListener('beforeprint', prepare)
    window.addEventListener('afterprint', restore)
    return () => {
      window.removeEventListener('beforeprint', prepare)
      window.removeEventListener('afterprint', restore)
    }
  }, [])
}
