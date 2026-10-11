import { PageVersion } from '../entities/page-version.entity.js';
import { Page, PageVisibility } from '../entities/page.entity.js';

export interface CreatePageWithFirstVersionInput {
  slug: string;
  title: string;
  content: string;
  parentId: string | null;
  visibility: PageVisibility;
  createdById: string;
}

export interface UpdatePageWithNewVersionInput {
  page: Page;
  title: string;
  content: string;
  changeSummary: string | null;
  authorId: string;
}

export interface PagesRepository {
  findById(id: string): Promise<Page | null>;
  findBySlugAndParent(
    slug: string,
    parentId: string | null,
  ): Promise<Page | null>;
  findAll(): Promise<Page[]>;
  findVersionById(id: string): Promise<PageVersion | null>;
  createWithFirstVersion(
    input: CreatePageWithFirstVersionInput,
  ): Promise<{ page: Page; version: PageVersion }>;
  updateWithNewVersion(
    input: UpdatePageWithNewVersionInput,
  ): Promise<{ page: Page; version: PageVersion }>;
  updateParent(page: Page, newParentId: string | null): Promise<Page>;
  findChildren(parentId: string): Promise<Page[]>;
  softDeleteBatch(
    ids: string[],
    deletedById: string,
    deletionRootId: string,
  ): Promise<void>;
  updateVisibility(page: Page, visibility: PageVisibility): Promise<Page>;
  updateCommentsEnabled(page: Page, commentsEnabled: boolean): Promise<Page>;
  countCreatedByUser(userId: string): Promise<number>;
  countVersionsByAuthor(userId: string): Promise<number>;
  incrementViewCount(id: string): Promise<void>;
  findTopPublicByViewCount(limit: number): Promise<Page[]>;
}
