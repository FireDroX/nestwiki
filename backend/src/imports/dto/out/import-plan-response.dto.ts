import type { IgnoredImportFileReason } from '../../services/import-archive.reader.js';
import type {
  ImportConflictMode,
  ImportPageAction,
  ImportRenameReason,
} from '../../services/import-planner.js';
import type { ImportFormat } from '../../services/import-tree.builder.js';

export interface ImportPlanPageDto {
  path: string;
  title: string;
  slug: string;
  tags: string[];
  linkCount: number;
  mediaCount: number;
  action: ImportPageAction;
  conflict: { id: string; path: string } | null;
  children: ImportPlanPageDto[];
}

export interface ImportPlanWarningsDto {
  unresolvedLinks: { page: string; target: string }[];
  ignoredFiles: { file: string; reason: IgnoredImportFileReason }[];
  missingTags: string[];
  mediaWithoutUpload: number;
  renamedSlugs: {
    page: string;
    from: string;
    to: string;
    reason: ImportRenameReason;
  }[];
}

export interface ImportPlanResponseDto {
  format: ImportFormat;
  destination: { id: string | null; path: string | null };
  conflictMode: ImportConflictMode;
  pageCount: number;
  conflictCount: number;
  pages: ImportPlanPageDto[];
  media: { count: number; totalSize: number };
  tags: { existing: string[]; missing: string[] };
  permissions: { canCreateTags: boolean; canUploadMedia: boolean };
  warnings: ImportPlanWarningsDto;
}
