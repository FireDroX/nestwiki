import type { MergeSegment } from '../../services/page-merge.service.js';

export interface PageUpdateResponseDto {
  id: string;
  slug: string;
  title: string;
  content: string;
  currentVersionId: string;
  updatedAt: Date;
  conflict: boolean;
  mergedContent?: string;
  segments?: MergeSegment[];
  currentVersionAuthorName?: string | null;
  currentVersionCreatedAt?: Date;
  currentVersionContent?: string;
}
