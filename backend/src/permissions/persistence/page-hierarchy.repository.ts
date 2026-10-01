import { PageVisibility } from '../../pages/entities/page.entity.js';

export interface PageChain {
  pageId: string;
  visibility: PageVisibility;
  chainIds: string[];
}

export interface PageHierarchyRepository {
  findChains(pageIds: string[]): Promise<Map<string, PageChain>>;
}
