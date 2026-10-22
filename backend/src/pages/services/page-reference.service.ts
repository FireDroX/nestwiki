import { Inject, Injectable } from '@nestjs/common';
import type { PageHierarchyRepository } from '../../permissions/persistence/page-hierarchy.repository.js';
import { PageReferenceDto } from '../dto/out/page-reference.dto.js';
import type { PageTrashRepository } from '../persistence/page-trash.repository.js';

@Injectable()
export class PageReferenceService {
  constructor(
    @Inject('PageTrashRepository')
    private readonly pageTrashRepository: PageTrashRepository,
    @Inject('PageHierarchyRepository')
    private readonly pageHierarchyRepository: PageHierarchyRepository,
  ) {}

  async describe(pageId: string): Promise<PageReferenceDto | null> {
    const page = await this.pageTrashRepository.findByIdWithDeleted(pageId);
    if (!page) {
      return null;
    }
    const [chains, paths] = await Promise.all([
      this.pageHierarchyRepository.findChains([pageId], {
        includeDeleted: true,
      }),
      this.pageTrashRepository.findPaths([pageId]),
    ]);
    const chainIds = chains.get(pageId)?.chainIds ?? [pageId];
    return {
      id: page.id,
      title: page.title,
      path: paths.get(pageId) ?? `/${page.slug}`,
      visibility: page.visibility,
      ancestorIds: chainIds.slice(1).reverse(),
      inTrash: page.deletedAt !== null,
    };
  }

  pathsOf(pageIds: string[]): Promise<Map<string, string>> {
    return this.pageTrashRepository.findPaths(pageIds);
  }
}
