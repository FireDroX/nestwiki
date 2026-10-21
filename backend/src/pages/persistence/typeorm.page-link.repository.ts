import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { replacePageLinks } from '../../database/page-links-index.js';
import { PageLinkRepository, PageLinkRow } from './page-link.repository.js';

@Injectable()
export class TypeormPageLinkRepository implements PageLinkRepository {
  constructor(private readonly dataSource: DataSource) {}

  replaceForPage(
    pageId: string,
    versionId: string,
    targetPaths: string[],
  ): Promise<void> {
    return this.dataSource.transaction((manager) =>
      replacePageLinks(
        (query, parameters) => manager.query(query, parameters),
        pageId,
        versionId,
        targetPaths,
      ),
    );
  }

  async findSourcePageIds(
    targetPath: string,
    includeDescendants: boolean,
  ): Promise<string[]> {
    const descendantsPattern = `${targetPath.replace(/[\\%_]/g, '\\$&')}/%`;
    const rows: { source_page_id: string }[] = await this.dataSource.query(
      `SELECT DISTINCT l.\`source_page_id\` FROM \`page_links\` l
        INNER JOIN \`pages\` p ON p.\`id\` = l.\`source_page_id\` AND p.\`deleted_at\` IS NULL
        WHERE (l.\`target_path\` = ?${includeDescendants ? ' OR l.`target_path` LIKE ?' : ''})`,
      includeDescendants ? [targetPath, descendantsPattern] : [targetPath],
    );
    return rows.map((row) => row.source_page_id);
  }

  async findAllFromActiveSources(): Promise<PageLinkRow[]> {
    const rows: { source_page_id: string; target_path: string }[] =
      await this.dataSource.query(
        `SELECT l.\`source_page_id\`, l.\`target_path\` FROM \`page_links\` l
          INNER JOIN \`pages\` p ON p.\`id\` = l.\`source_page_id\` AND p.\`deleted_at\` IS NULL`,
      );
    return rows.map((row) => ({
      sourcePageId: row.source_page_id,
      targetPath: row.target_path,
    }));
  }
}
