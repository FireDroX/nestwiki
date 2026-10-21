import { Inject, Injectable } from '@nestjs/common';
import { PageReferenceDto } from '../dto/out/page-reference.dto.js';
import { Page } from '../entities/page.entity.js';
import type { PageTrashRepository } from '../persistence/page-trash.repository.js';

@Injectable()
export class PageReferenceService {
  constructor(
    @Inject('PageTrashRepository')
    private readonly pageTrashRepository: PageTrashRepository,
  ) {}

  async describe(pageId: string): Promise<PageReferenceDto | null> {
    const page = await this.pageTrashRepository.findByIdWithDeleted(pageId);
    if (!page) {
      return null;
    }
    const ancestors = await this.findAncestors(page);
    return {
      id: page.id,
      title: page.title,
      path: `/${[...ancestors, page].map((node) => node.slug).join('/')}`,
      visibility: page.visibility,
      ancestorIds: ancestors.map((ancestor) => ancestor.id),
      inTrash: page.deletedAt !== null,
    };
  }

  private async findAncestors(page: Page): Promise<Page[]> {
    const ancestors: Page[] = [];
    const visited = new Set([page.id]);
    let parentId = page.parentId;
    while (parentId !== null && !visited.has(parentId)) {
      const parent =
        await this.pageTrashRepository.findByIdWithDeleted(parentId);
      if (!parent) {
        break;
      }
      visited.add(parent.id);
      ancestors.unshift(parent);
      parentId = parent.parentId;
    }
    return ancestors;
  }
}
