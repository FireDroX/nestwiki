import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageLinksInitializer } from './page-links.initializer.js';

describe('PageLinksInitializer', () => {
  let initializer: PageLinksInitializer;
  let dataSource: {
    query: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  };
  let transactionQuery: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    transactionQuery = vi.fn().mockResolvedValue([]);
    dataSource = {
      query: vi.fn((query: string) =>
        Promise.resolve(
          query.startsWith('SELECT `id`')
            ? [
                { id: 'page-a', current_version_id: 'version-a' },
                { id: 'page-b', current_version_id: 'version-b' },
              ]
            : [{ content: '[a](/pages/docs)' }],
        ),
      ),
      transaction: vi.fn(
        (work: (manager: { query: typeof transactionQuery }) => unknown) =>
          work({ query: transactionQuery }),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PageLinksInitializer,
        { provide: DataSource, useValue: dataSource },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockReturnValue('https://wiki.example.com'),
          },
        },
      ],
    }).compile();

    initializer = moduleRef.get(PageLinksInitializer);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes the links of each stale page inside a transaction', async () => {
    await initializer.onApplicationBootstrap();

    expect(dataSource.transaction).toHaveBeenCalledTimes(2);
    expect(transactionQuery).toHaveBeenCalledWith(
      'INSERT INTO `page_links` (`source_page_id`, `target_path`) VALUES (?, ?)',
      ['page-a', '/docs'],
    );
  });

  it('names the pages it could not index without stopping the startup', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    dataSource.transaction.mockRejectedValueOnce(new Error('ER_DUP_ENTRY'));

    await expect(initializer.onApplicationBootstrap()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('page-a'));
  });

  it('does not stop the startup when the index cannot be read', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    dataSource.query.mockRejectedValue(new Error('down'));

    await expect(initializer.onApplicationBootstrap()).resolves.toBeUndefined();
  });
});
