import { apiClient } from '#lib/api-client'
import type { ResponseDto } from '#api/response-dto'
import type { PageVisibility } from '#api/pages'

export const IMPORT_MAX_ARCHIVE_SIZE_MB = 100
export const IMPORT_MAX_UNCOMPRESSED_SIZE_MB = 500
export const IMPORT_MAX_PAGES = 1000
export const IMPORT_ACCEPTED_EXTENSIONS = ['.zip', '.md']

export const IMPORT_CONFLICT_MODES = ['skip', 'rename', 'update'] as const
export type ImportConflictMode = (typeof IMPORT_CONFLICT_MODES)[number]
export type ImportFormat = 'nestwiki' | 'obsidian' | 'markdown'
export type ImportPageAction = 'create' | 'update' | 'skip'
export type IgnoredImportFileReason = 'symlink' | 'encrypted' | 'unsupported_type' | 'too_large' | 'unreferenced'
export type ImportRenameReason = 'reserved' | 'duplicate' | 'conflict'
export type ImportSkipReason = 'exists' | 'forbidden'

export interface ImportPlanPage {
  path: string
  title: string
  slug: string
  tags: string[]
  linkCount: number
  mediaCount: number
  action: ImportPageAction
  conflict: { path: string } | null
  children: ImportPlanPage[]
}

export interface ImportWarnings {
  unresolvedLinks: { page: string; target: string }[]
  ignoredFiles: { file: string; reason: IgnoredImportFileReason }[]
  missingTags: string[]
  mediaWithoutUpload: number
  renamedSlugs: { page: string; from: string; to: string; reason: ImportRenameReason }[]
}

export interface ImportPlan {
  format: ImportFormat
  destination: { id: string | null; path: string | null }
  conflictMode: ImportConflictMode
  pageCount: number
  conflictCount: number
  pages: ImportPlanPage[]
  media: { count: number; totalSize: number }
  tags: { existing: string[]; missing: string[] }
  permissions: { canCreateTags: boolean; canUploadMedia: boolean }
  warnings: ImportWarnings
}

export interface ImportedPage {
  id: string
  path: string
  title: string
}

export interface ImportReport {
  rootPath: string | null
  created: ImportedPage[]
  updated: ImportedPage[]
  skipped: { path: string; title: string; reason: ImportSkipReason }[]
  media: { uploaded: number }
  tags: { created: string[]; skipped: string[] }
  warnings: ImportWarnings
}

export interface ImportOptions {
  parentId: string | null
  conflict: ImportConflictMode
  visibility: PageVisibility
  createMissingTags: boolean
}

function importForm(file: File, fields: Record<string, string>): FormData {
  const formData = new FormData()
  formData.append('file', file)
  for (const [name, value] of Object.entries(fields)) {
    formData.append(name, value)
  }
  return formData
}

export async function previewImport(
  file: File,
  parentId: string | null,
  conflict: ImportConflictMode,
): Promise<ImportPlan> {
  const { data } = await apiClient.post<ResponseDto<ImportPlan>>(
    '/imports/preview',
    importForm(file, { ...(parentId ? { parentId } : {}), conflict }),
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data.data
}

export async function runImport(
  file: File,
  options: ImportOptions,
  onUploadProgress?: (percent: number) => void,
): Promise<ImportReport> {
  const { data } = await apiClient.post<ResponseDto<ImportReport>>(
    '/imports',
    importForm(file, {
      ...(options.parentId ? { parentId: options.parentId } : {}),
      conflict: options.conflict,
      visibility: options.visibility,
      createMissingTags: String(options.createMissingTags),
    }),
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (event.total) {
          onUploadProgress?.(Math.round((event.loaded / event.total) * 100))
        }
      },
    },
  )
  return data.data
}
