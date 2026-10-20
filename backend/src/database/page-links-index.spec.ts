import { describe, expect, it, vi } from 'vitest';
import { reindexStalePageLinks, replacePageLinks } from './page-links-index.js';

const INSTANCE_URL = 'https://wiki.example.com';

function mockRunQuery() {
  return vi
    .fn<(query: string, parameters?: unknown[]) => Promise<unknown>>()
    .mockResolvedValue([]);
}

describe('replacePageLinks', () => {
  it('replaces the links of the page and records the indexed version last', async () => {
    const runQuery = mockRunQuery();

    await replacePageLinks(runQuery, 'page-1', 'version-2', ['/a', '/b']);

    expect(runQuery.mock.calls).toEqual([
      ['DELETE FROM `page_links` WHERE `source_page_id` = ?', ['page-1']],
      [
        'INSERT INTO `page_links` (`source_page_id`, `target_path`) VALUES (?, ?), (?, ?)',
        ['page-1', '/a', 'page-1', '/b'],
      ],
      [
        'UPDATE `pages` SET `links_version_id` = ? WHERE `id` = ?',
        ['version-2', 'page-1'],
      ],
    ]);
  });

  it('only clears the links of a page that links nowhere', async () => {
    const runQuery = mockRunQuery();

    await replacePageLinks(runQuery, 'page-1', 'version-2', []);

    expect(runQuery.mock.calls.map(([query]) => query)).toEqual([
      'DELETE FROM `page_links` WHERE `source_page_id` = ?',
      'UPDATE `pages` SET `links_version_id` = ? WHERE `id` = ?',
    ]);
  });
});

describe('reindexStalePageLinks', () => {
  it('indexes the current version of every active page whose links are stale', async () => {
    const contents: Record<string, string> = {
      'version-a': '[Guide](/pages/docs/guide)',
      'version-b': `[FAQ](${INSTANCE_URL}/pages/faq) [code](\`/pages/x\`)`,
    };
    const runQuery = vi.fn((query: string, parameters?: unknown[]) => {
      if (query.startsWith('SELECT `id`, `current_version_id`')) {
        return Promise.resolve([
          { id: 'page-a', current_version_id: 'version-a' },
          { id: 'page-b', current_version_id: 'version-b' },
        ]);
      }
      if (query.startsWith('SELECT `content`')) {
        return Promise.resolve([
          { content: contents[parameters![0] as string] },
        ]);
      }
      return Promise.resolve([]);
    });

    await expect(reindexStalePageLinks(runQuery, INSTANCE_URL)).resolves.toBe(
      2,
    );

    const staleQuery = runQuery.mock.calls[0][0];
    expect(staleQuery).toContain('`deleted_at` IS NULL');
    expect(staleQuery).toContain(
      'NOT (`links_version_id` <=> `current_version_id`)',
    );
    expect(runQuery).toHaveBeenCalledWith(
      'INSERT INTO `page_links` (`source_page_id`, `target_path`) VALUES (?, ?)',
      ['page-a', '/docs/guide'],
    );
    expect(runQuery).toHaveBeenCalledWith(
      'INSERT INTO `page_links` (`source_page_id`, `target_path`) VALUES (?, ?)',
      ['page-b', '/faq'],
    );
    expect(runQuery).toHaveBeenCalledWith(
      'UPDATE `pages` SET `links_version_id` = ? WHERE `id` = ?',
      ['version-b', 'page-b'],
    );
  });
});
