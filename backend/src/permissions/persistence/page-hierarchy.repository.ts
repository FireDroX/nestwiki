import { PageVisibility } from '../../pages/entities/page.entity.js';

export interface PageChain {
  pageId: string;
  visibility: PageVisibility;
  chainIds: string[];
}

export interface PageHierarchyRepository {
  findChains(pageIds: string[]): Promise<Map<string, PageChain>>;
  /** For each given page id, itself plus every descendant id. */
  findDescendantIds(pageIds: string[]): Promise<Map<string, string[]>>;
  findAllPageIds(): Promise<string[]>;
}
