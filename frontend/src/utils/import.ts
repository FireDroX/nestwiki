import type { ImportWarnings } from '#api/imports'
import type { PageTreeNode } from '#api/pages'

export const IMPORT_STEPS = ['file', 'preview', 'import', 'report'] as const
export type ImportStep = (typeof IMPORT_STEPS)[number]

export interface ImportDestinationOption {
  id: string
  label: string
}

export function importableDestinations(
  nodes: PageTreeNode[],
  parentLabel: string[] = [],
): ImportDestinationOption[] {
  return nodes.flatMap((node) => {
    const label = [...parentLabel, node.title]
    const option = node.canCreateChild ? [{ id: node.id, label: label.join(' / ') }] : []
    return [...option, ...importableDestinations(node.children, label)]
  })
}

export function hasImportWarnings(warnings: ImportWarnings): boolean {
  return (
    warnings.unresolvedLinks.length > 0 ||
    warnings.ignoredFiles.length > 0 ||
    warnings.missingTags.length > 0 ||
    warnings.mediaWithoutUpload > 0 ||
    warnings.renamedSlugs.length > 0
  )
}
