import type { MergeSegment } from '../../services/page-merge.service.js';

export interface PageMergePreviewResponseDto {
  conflict: boolean;
  mergedContent: string;
  newBaseVersionId: string;
  segments?: MergeSegment[];
  currentVersionAuthorName?: string | null;
  currentVersionCreatedAt?: Date;
}
