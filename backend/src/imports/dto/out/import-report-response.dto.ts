import type { ImportSkipReason } from '../../services/imports.service.js';
import type { ImportPlanWarningsDto } from './import-plan-response.dto.js';

export interface ImportedPageDto {
  id: string;
  path: string;
  title: string;
}

export interface SkippedImportPageDto {
  path: string;
  title: string;
  reason: ImportSkipReason;
}

export interface ImportReportResponseDto {
  rootPath: string | null;
  created: ImportedPageDto[];
  updated: ImportedPageDto[];
  skipped: SkippedImportPageDto[];
  media: { uploaded: number };
  tags: { created: string[]; skipped: string[] };
  warnings: ImportPlanWarningsDto;
}
