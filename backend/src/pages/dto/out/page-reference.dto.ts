import type { PageVisibility } from '../../entities/page.entity.js';

export interface PageReferenceDto {
  id: string;
  title: string;
  path: string;
  visibility: PageVisibility;
  ancestorIds: string[];
  inTrash: boolean;
}
