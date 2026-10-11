import { PageVersion } from '../../entities/page-version.entity.js';
import type { MergeSegment } from '../../services/page-merge.service.js';
import { Page } from '../../entities/page.entity.js';

export interface UpdatePageResultDto {
  page: Page;
  version: PageVersion;
  conflict: boolean;
  mergedContent?: string;
  segments?: MergeSegment[];
  currentVersionAuthorName?: string | null;
  currentVersionCreatedAt?: Date;
}
