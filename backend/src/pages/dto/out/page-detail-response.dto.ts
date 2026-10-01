import type { PageAction } from '../../../common/permissions.js';
import { PageVisibility } from '../../entities/page.entity.js';

export interface PageDetailResponseDto {
  id: string;
  slug: string;
  title: string;
  content: string;
  visibility: PageVisibility;
  commentsEnabled: boolean;
  parentId: string | null;
  updatedAt: Date;
  isFollowed: boolean;
  currentVersionId: string;
  permissions: PageAction[];
}
