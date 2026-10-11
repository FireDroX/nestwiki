export function isPrintableContentReady(root: ParentNode): boolean {
  const diagramsPending = root.querySelector('[data-slot="mermaid-loading"]') !== null
  const imagesPending = [...root.querySelectorAll('img')].some((image) => !image.complete)
  return !diagramsPending && !imagesPending
}
