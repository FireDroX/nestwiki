import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PageVisibility } from '../../pages/entities/page.entity.js';
import {
  PageChain,
  PageHierarchyRepository,
} from './page-hierarchy.repository.js';

interface ChainRow {
  root_id: string;
  id: string;
  visibility: PageVisibility;
  depth: number;
}

@Injectable()
export class TypeormPageHierarchyRepository implements PageHierarchyRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findChains(pageIds: string[]): Promise<Map<string, PageChain>> {
    const result = new Map<string, PageChain>();
    if (pageIds.length === 0) {
      return result;
    }

    const placeholders = pageIds.map(() => '?').join(', ');
    const rows: ChainRow[] = await this.dataSource.query(
      `WITH RECURSIVE chain AS (
        SELECT id, parent_id, visibility, id AS root_id, 0 AS depth
        FROM pages
        WHERE id IN (${placeholders}) AND deleted_at IS NULL
        UNION ALL
        SELECT p.id, p.parent_id, p.visibility, c.root_id, c.depth + 1
        FROM pages p
        INNER JOIN chain c ON p.id = c.parent_id AND p.deleted_at IS NULL
      )
      SELECT root_id, id, visibility, depth FROM chain ORDER BY root_id, depth ASC`,
      pageIds,
    );

    for (const row of rows) {
      let chain = result.get(row.root_id);
      if (!chain) {
        chain = {
          pageId: row.root_id,
          visibility: row.visibility,
          chainIds: [],
        };
        result.set(row.root_id, chain);
      }
      chain.chainIds.push(row.id);
    }

    return result;
  }
}
