import { PageTag } from '../entities/page-tag.entity.js';
import { Tag } from '../entities/tag.entity.js';

export interface TagRepository {
  findAll(): Promise<Tag[]>;
  findById(id: string): Promise<Tag | null>;
  findByName(name: string): Promise<Tag | null>;
  create(name: string, color: string): Promise<Tag>;
  delete(id: string): Promise<void>;
  findPageTag(pageId: string, tagId: string): Promise<PageTag | null>;
  createPageTag(pageId: string, tagId: string): Promise<PageTag>;
  deletePageTag(pageId: string, tagId: string): Promise<void>;
  findTagsByPageId(pageId: string): Promise<Tag[]>;
  findTagNamesByPageIds(pageIds: string[]): Promise<Map<string, string[]>>;
}
