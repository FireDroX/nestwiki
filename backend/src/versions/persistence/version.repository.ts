import { PageVersion } from '../../pages/entities/page-version.entity.js';

export interface CreateVersionInput {
  pageId: string;
  content: string;
  title: string;
  authorId: string;
  changeSummary: string | null;
}

export interface FindAllByPageResult {
  items: PageVersion[];
  total: number;
}

export interface ContributorRow {
  authorId: string;
  lastContributedAt: Date;
}

export interface VersionsRepository {
  create(input: CreateVersionInput): Promise<PageVersion>;
  findAllByPageId(
    pageId: string,
    page: number,
    limit: number,
  ): Promise<FindAllByPageResult>;
  findByIdAndPageId(id: string, pageId: string): Promise<PageVersion | null>;
  findContributorsByPageId(pageId: string): Promise<ContributorRow[]>;
  countByPageId(pageId: string): Promise<number>;
  countContributorsByPageId(pageId: string): Promise<number>;
}
