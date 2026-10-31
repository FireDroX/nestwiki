import { Page } from '../entities/page.entity.js';

export interface PageTrashRepository {
  findDeletionRoots(): Promise<Page[]>;
  countBatches(rootIds: string[]): Promise<Map<string, number>>;
  findTrashedById(id: string): Promise<Page | null>;
  findByIdWithDeleted(id: string): Promise<Page | null>;
  findPaths(pageIds: string[]): Promise<Map<string, string>>;
  restoreBatch(rootId: string): Promise<void>;
  findTrashedSubtreeIds(rootId: string): Promise<string[]>;
  purge(pageIds: string[]): Promise<string[]>;
}
