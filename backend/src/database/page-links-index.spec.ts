import { describe, expect, it, vi } from 'vitest';
import { reindexStalePageLinks, replacePageLinks } from './page-links-index.js';

const INSTANCE_URL = 'https://wiki.example.com';

type RunQuery = (query: string, parameters?: unknown[]) => Promise<unknown>;

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
  const contents: Record<string, string> = {
    'version-a': '[Guide](/pages/docs/guide)',
    'version-b': `[FAQ](${INSTANCE_URL}/pages/faq) [code](\`/pages/x\`)`,
  };

  function mockDatabase() {
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
    const transactionQueries: [string, unknown[] | undefined][] = [];
    const runInTransaction = vi.fn(
      (work: (transactionQuery: RunQuery) => Promise<void>) =>
        work((query, parameters) => {
          transactionQueries.push([query, parameters]);
          return Promise.resolve([]);
        }),
    );
    return { runQuery, runInTransaction, transactionQueries };
  }

  it('indexes the current version of every active page whose links are stale', async () => {
    const { runQuery, runInTransaction, transactionQueries } = mockDatabase();

    await expect(
      reindexStalePageLinks(runQuery, runInTransaction, INSTANCE_URL),
    ).resolves.toEqual({ indexed: 2, failedPageIds: [] });

    const staleQuery = runQuery.mock.calls[0][0];
    expect(staleQuery).toContain('`deleted_at` IS NULL');
    expect(staleQuery).toContain(
      'NOT (`links_version_id` <=> `current_version_id`)',
    );
    expect(transactionQueries).toContainEqual([
      'INSERT INTO `page_links` (`source_page_id`, `target_path`) VALUES (?, ?)',
      ['page-a', '/docs/guide'],
    ]);
    expect(transactionQueries).toContainEqual([
      'INSERT INTO `page_links` (`source_page_id`, `target_path`) VALUES (?, ?)',
      ['page-b', '/faq'],
    ]);
    expect(transactionQueries).toContainEqual([
      'UPDATE `pages` SET `links_version_id` = ? WHERE `id` = ?',
      ['version-b', 'page-b'],
    ]);
  });

  it('replaces the links of each page in its own transaction', async () => {
    const { runQuery, runInTransaction } = mockDatabase();

    await reindexStalePageLinks(runQuery, runInTransaction, INSTANCE_URL);

    expect(runInTransaction).toHaveBeenCalledTimes(2);
    expect(
      runQuery.mock.calls.some(([query]) => !query.startsWith('SELECT')),
    ).toBe(false);
  });

  it('keeps going past a page whose links cannot be written and reports it', async () => {
    const { runQuery, runInTransaction } = mockDatabase();
    runInTransaction.mockRejectedValueOnce(new Error('ER_DUP_ENTRY'));

    await expect(
      reindexStalePageLinks(runQuery, runInTransaction, INSTANCE_URL),
    ).resolves.toEqual({ indexed: 1, failedPageIds: ['page-a'] });
  });
});
