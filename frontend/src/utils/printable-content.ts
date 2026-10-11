export function isPrintableContentReady(root: ParentNode): boolean {
  const diagramsPending = root.querySelector('[data-print-pending]') !== null
  const imagesPending = [...root.querySelectorAll('img')].some((image) => !image.complete)
  const fontsPending = document.fonts?.status === 'loading'
  return !diagramsPending && !imagesPending && !fontsPending
}
