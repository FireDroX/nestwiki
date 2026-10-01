import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  SearchMatch,
  SearchMatchTag,
  SearchRepository,
} from './search.repository.js';

interface SearchRow {
  pageId: string;
  slug: string;
  title: string;
  content: string;
  score: number;
}

interface CountRow {
  total: string;
}

interface TagRow {
  pageId: string;
  id: string;
  name: string;
  color: string;
}

const BOOLEAN_MODE_OPERATORS = /[+\-<>()~*"@]/g;

function toBooleanModePrefixQuery(query: string): string {
  return query
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `${term.replace(BOOLEAN_MODE_OPERATORS, '')}*`)
    .join(' ');
}

function toSearchTerms(query: string): string[] {
  return query
    .split(/\s+/)
    .map((term) => term.replace(BOOLEAN_MODE_OPERATORS, ''))
    .filter(Boolean);
}

@Injectable()
export class TypeormSearchRepository implements SearchRepository {
  constructor(private readonly dataSource: DataSource) {}

  async search(
    query: string,
    page: number,
    limit: number,
    readablePageIds: string[] | null,
  ): Promise<{ items: SearchMatch[]; total: number }> {
    const publicOnlyClause =
      "p.is_published = true AND p.visibility = 'public'";
    const visibilityClause =
      readablePageIds === null
        ? ''
        : readablePageIds.length > 0
          ? `AND (${publicOnlyClause} OR p.id IN (${readablePageIds.map(() => '?').join(', ')}))`
          : `AND ${publicOnlyClause}`;
    const visibilityParams = readablePageIds?.length ? readablePageIds : [];
    const offset = (page - 1) * limit;
    const booleanQuery = toBooleanModePrefixQuery(query);
    const tagTerms = toSearchTerms(query);
    const tagClause = tagTerms.length
      ? `OR EXISTS (
           SELECT 1 FROM page_tags pt
           INNER JOIN tags t ON t.id = pt.tag_id
           WHERE pt.page_id = p.id AND (${tagTerms.map(() => 't.name LIKE ?').join(' OR ')})
         )`
      : '';
    const tagParams = tagTerms.map((term) => `${term}%`);

    const rows = await this.dataSource.query<SearchRow[]>(
      `SELECT
         p.id AS pageId,
         p.slug AS slug,
         pv.title AS title,
         pv.content AS content,
         MATCH (pv.title, pv.content) AGAINST (? IN BOOLEAN MODE) AS score
       FROM pages p
       INNER JOIN page_versions pv ON pv.id = p.current_version_id
       WHERE p.deleted_at IS NULL
         AND (MATCH (pv.title, pv.content) AGAINST (? IN BOOLEAN MODE) ${tagClause})
         ${visibilityClause}
       ORDER BY score DESC
       LIMIT ? OFFSET ?`,
      [
        booleanQuery,
        booleanQuery,
        ...tagParams,
        ...visibilityParams,
        limit,
        offset,
      ],
    );

    const countRows = await this.dataSource.query<CountRow[]>(
      `SELECT COUNT(*) AS total
       FROM pages p
       INNER JOIN page_versions pv ON pv.id = p.current_version_id
       WHERE p.deleted_at IS NULL
         AND (MATCH (pv.title, pv.content) AGAINST (? IN BOOLEAN MODE) ${tagClause})
         ${visibilityClause}`,
      [booleanQuery, ...tagParams, ...visibilityParams],
    );

    const tagsByPageId = await this.fetchTagsByPageId(
      rows.map((row) => row.pageId),
    );

    return {
      items: rows.map((row) => ({
        ...row,
        tags: tagsByPageId.get(row.pageId) ?? [],
      })),
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  private async fetchTagsByPageId(
    pageIds: string[],
  ): Promise<Map<string, SearchMatchTag[]>> {
    const tagsByPageId = new Map<string, SearchMatchTag[]>();
    if (pageIds.length === 0) {
      return tagsByPageId;
    }

    const placeholders = pageIds.map(() => '?').join(', ');
    const rows = await this.dataSource.query<TagRow[]>(
      `SELECT
         pt.page_id AS pageId,
         t.id AS id,
         t.name AS name,
         t.color AS color
       FROM page_tags pt
       INNER JOIN tags t ON t.id = pt.tag_id
       WHERE pt.page_id IN (${placeholders})`,
      pageIds,
    );

    for (const row of rows) {
      const tags = tagsByPageId.get(row.pageId) ?? [];
      tags.push({ id: row.id, name: row.name, color: row.color });
      tagsByPageId.set(row.pageId, tags);
    }
    return tagsByPageId;
  }
}
