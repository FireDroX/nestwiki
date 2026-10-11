import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { PageVersion } from '../entities/page-version.entity.js';
import { Page, PageVisibility } from '../entities/page.entity.js';
import {
  CreatePageWithFirstVersionInput,
  PagesRepository,
  UpdatePageWithNewVersionInput,
} from './page.repository.js';

@Injectable()
export class TypeormPagesRepository implements PagesRepository {
  constructor(
    @InjectRepository(Page) private readonly repository: Repository<Page>,
    @InjectRepository(PageVersion)
    private readonly versionRepository: Repository<PageVersion>,
    private readonly dataSource: DataSource,
  ) {}

  findById(id: string): Promise<Page | null> {
    return this.repository.findOneBy({ id });
  }

  findVersionById(id: string): Promise<PageVersion | null> {
    return this.versionRepository.findOneBy({ id });
  }

  findBySlugAndParent(
    slug: string,
    parentId: string | null,
  ): Promise<Page | null> {
    return this.repository.findOneBy({
      slug,
      parentId: parentId === null ? IsNull() : parentId,
    });
  }

  findAll(): Promise<Page[]> {
    return this.repository.find({ order: { createdAt: 'ASC' } });
  }

  async createWithFirstVersion(
    input: CreatePageWithFirstVersionInput,
  ): Promise<{ page: Page; version: PageVersion }> {
    return this.dataSource.transaction(async (manager) => {
      const page = await manager.save(
        manager.create(Page, {
          slug: input.slug,
          title: input.title,
          parentId: input.parentId,
          visibility: input.visibility,
          createdById: input.createdById,
        }),
      );

      const version = await manager.save(
        manager.create(PageVersion, {
          pageId: page.id,
          content: input.content,
          title: input.title,
          authorId: input.createdById,
        }),
      );

      page.currentVersionId = version.id;
      await manager.save(page);

      return { page, version };
    });
  }

  async updateWithNewVersion(
    input: UpdatePageWithNewVersionInput,
  ): Promise<{ page: Page; version: PageVersion }> {
    return this.dataSource.transaction(async (manager) => {
      const version = await manager.save(
        manager.create(PageVersion, {
          pageId: input.page.id,
          content: input.content,
          title: input.title,
          authorId: input.authorId,
          changeSummary: input.changeSummary,
        }),
      );

      const page = await manager.save(
        manager.merge(Page, input.page, {
          title: input.title,
          currentVersionId: version.id,
        }),
      );

      return { page, version };
    });
  }

  async updateParent(page: Page, newParentId: string | null): Promise<Page> {
    const updated = this.repository.merge(page, { parentId: newParentId });
    return this.repository.save(updated);
  }

  findChildren(parentId: string): Promise<Page[]> {
    return this.repository.findBy({ parentId });
  }

  async softDeleteBatch(
    ids: string[],
    deletedById: string,
    deletionRootId: string,
  ): Promise<void> {
    await this.repository.update(
      { id: In(ids) },
      { deletedAt: new Date(), deletedById, deletionRootId },
    );
  }

  async updateVisibility(
    page: Page,
    visibility: PageVisibility,
  ): Promise<Page> {
    const updated = this.repository.merge(page, { visibility });
    return this.repository.save(updated);
  }

  async updateCommentsEnabled(
    page: Page,
    commentsEnabled: boolean,
  ): Promise<Page> {
    const updated = this.repository.merge(page, { commentsEnabled });
    return this.repository.save(updated);
  }

  countCreatedByUser(userId: string): Promise<number> {
    return this.repository.count({ where: { createdById: userId } });
  }

  countVersionsByAuthor(userId: string): Promise<number> {
    return this.versionRepository.count({ where: { authorId: userId } });
  }

  async incrementViewCount(id: string): Promise<void> {
    await this.repository.increment({ id }, 'viewCount', 1);
  }

  findTopPublicByViewCount(limit: number): Promise<Page[]> {
    return this.repository.find({
      where: { visibility: 'public' },
      order: { viewCount: 'DESC' },
      take: limit,
    });
  }
}
