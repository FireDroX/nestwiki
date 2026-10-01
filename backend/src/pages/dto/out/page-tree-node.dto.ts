import type { PageVisibility } from '../../entities/page.entity.js';

export interface PageTreeNodeDto {
  id: string;
  slug: string;
  title: string;
  visibility: PageVisibility;
  canCreateChild: boolean;
  children: PageTreeNodeDto[];
}
