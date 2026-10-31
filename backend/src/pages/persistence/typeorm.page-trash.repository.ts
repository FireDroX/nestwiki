import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { Page } from '../entities/page.entity.js';
import { PageTrashRepository } from './page-trash.repository.js';

@Injectable()
export class TypeormPageTrashRepository implements PageTrashRepository {
  constructor(
    @InjectRepository(Page) private readonly repository: Repository<Page>,
    private readonly dataSource: DataSource,
  ) {}

  findDeletionRoots(): Promise<Page[]> {
    return this.repository
      .createQueryBuilder('page')
      .withDeleted()
      .where('page.deletedAt IS NOT NULL')
      .andWhere('page.id = page.deletionRootId')
      .orderBy('page.deletedAt', 'DESC')
      .getMany();
  }

  async countBatches(rootIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (rootIds.length === 0) {
      return counts;
    }
    const rows = await this.repository
      .createQueryBuilder('page')
      .withDeleted()
      .select('page.deletionRootId', 'rootId')
      .addSelect('COUNT(*)', 'total')
      .where('page.deletionRootId IN (:...rootIds)', { rootIds })
      .groupBy('page.deletionRootId')
      .getRawMany<{ rootId: string; total: string }>();
    for (const row of rows) {
      counts.set(row.rootId, Number(row.total));
    }
    return counts;
  }

  findTrashedById(id: string): Promise<Page | null> {
    return this.repository.findOne({
      where: { id, deletedAt: Not(IsNull()) },
      withDeleted: true,
    });
  }

  findByIdWithDeleted(id: string): Promise<Page | null> {
    return this.repository.findOne({ where: { id }, withDeleted: true });
  }

  async findPaths(pageIds: string[]): Promise<Map<string, string>> {
    const paths = new Map<string, string>();
    if (pageIds.length === 0) {
      return paths;
    }
    const placeholders = pageIds.map(() => '?').join(', ');
    const rows: { root_id: string; slug: string }[] =
      await this.dataSource.query(
        `WITH RECURSIVE chain AS (
          SELECT id, parent_id, slug, id AS root_id, 0 AS depth
          FROM pages
          WHERE id IN (${placeholders})
          UNION ALL
          SELECT p.id, p.parent_id, p.slug, c.root_id, c.depth + 1
          FROM pages p
          INNER JOIN chain c ON p.id = c.parent_id
        )
        SELECT root_id, slug FROM chain ORDER BY root_id, depth DESC`,
        pageIds,
      );
    for (const row of rows) {
      paths.set(row.root_id, `${paths.get(row.root_id) ?? ''}/${row.slug}`);
    }
    return paths;
  }

  async restoreBatch(rootId: string): Promise<void> {
    await this.repository.update(
      { deletionRootId: rootId },
      { deletedAt: null, deletedById: null, deletionRootId: null },
    );
  }

  async findTrashedSubtreeIds(rootId: string): Promise<string[]> {
    const rows: { id: string }[] = await this.dataSource.query(
      `WITH RECURSIVE subtree AS (
        SELECT id FROM pages WHERE id = ? AND deleted_at IS NOT NULL
        UNION ALL
        SELECT p.id FROM pages p
        INNER JOIN subtree s ON p.parent_id = s.id AND p.deleted_at IS NOT NULL
      )
      SELECT id FROM subtree`,
      [rootId],
    );
    return rows.map((row) => row.id);
  }

  async purge(pageIds: string[]): Promise<string[]> {
    if (pageIds.length === 0) {
      return [];
    }
    const placeholders = pageIds.map(() => '?').join(', ');
    return this.dataSource.transaction(async (manager) => {
      const attachments: { id: string }[] = await manager.query(
        `SELECT id FROM attachments WHERE page_id IN (${placeholders}) FOR UPDATE`,
        pageIds,
      );
      await manager.query(
        `UPDATE attachments SET page_id = NULL WHERE page_id IN (${placeholders})`,
        pageIds,
      );
      await manager.query(
        `DELETE FROM page_follows WHERE page_id IN (${placeholders})`,
        pageIds,
      );
      await manager.query(
        `DELETE FROM comments WHERE page_id IN (${placeholders})`,
        pageIds,
      );
      await manager.query(
        `DELETE FROM page_versions WHERE page_id IN (${placeholders})`,
        pageIds,
      );
      await manager.query(
        `DELETE FROM pages WHERE id IN (${placeholders})`,
        pageIds,
      );
      return attachments.map((attachment) => attachment.id);
    });
  }
}
