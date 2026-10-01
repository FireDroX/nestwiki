import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './support/create-test-app.js';
import { resetDatabase } from './support/reset-database.js';

async function insertUser(dataSource: DataSource): Promise<string> {
  const id = randomUUID();
  await dataSource.query(
    'INSERT INTO `users` (`id`, `email`, `password_hash`, `display_name`) VALUES (?, ?, ?, ?)',
    [id, `${id}@example.com`, 'hash', 'Test User'],
  );
  return id;
}

async function insertGroup(dataSource: DataSource): Promise<string> {
  const id = randomUUID();
  await dataSource.query('INSERT INTO `groups` (`id`, `name`) VALUES (?, ?)', [
    id,
    `group-${id}`,
  ]);
  return id;
}

async function insertPage(
  dataSource: DataSource,
  createdById: string,
): Promise<string> {
  const id = randomUUID();
  await dataSource.query(
    'INSERT INTO `pages` (`id`, `slug`, `title`, `created_by_id`) VALUES (?, ?, ?, ?)',
    [id, `page-${id}`, 'Test Page', createdById],
  );
  return id;
}

describe('Permissions schema (e2e)', () => {
  let app: INestApplication;
  let close: () => Promise<void>;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, close } = await createTestApp());
    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await resetDatabase(dataSource);
  });

  afterAll(async () => {
    await close();
  });

  it('rejects a page_access_rule with both a user and a group', async () => {
    const userId = await insertUser(dataSource);
    const groupId = await insertGroup(dataSource);
    const granterId = await insertUser(dataSource);

    await expect(
      dataSource.query(
        'INSERT INTO `page_access_rules` (`id`, `user_id`, `group_id`, `applies_to`, `actions`, `granted_by_id`) VALUES (?, ?, ?, ?, ?, ?)',
        [
          randomUUID(),
          userId,
          groupId,
          'subtree',
          JSON.stringify(['page.read']),
          granterId,
        ],
      ),
    ).rejects.toThrow();
  });

  it('rejects a page_access_rule with neither a user nor a group', async () => {
    const granterId = await insertUser(dataSource);

    await expect(
      dataSource.query(
        'INSERT INTO `page_access_rules` (`id`, `applies_to`, `actions`, `granted_by_id`) VALUES (?, ?, ?, ?)',
        [randomUUID(), 'subtree', JSON.stringify(['page.read']), granterId],
      ),
    ).rejects.toThrow();
  });

  it('accepts a page_access_rule with exactly a user, and one with exactly a group', async () => {
    const userId = await insertUser(dataSource);
    const groupId = await insertGroup(dataSource);
    const granterId = await insertUser(dataSource);

    await expect(
      dataSource.query(
        'INSERT INTO `page_access_rules` (`id`, `user_id`, `applies_to`, `actions`, `granted_by_id`) VALUES (?, ?, ?, ?, ?)',
        [
          randomUUID(),
          userId,
          'subtree',
          JSON.stringify(['page.read']),
          granterId,
        ],
      ),
    ).resolves.toBeDefined();

    await expect(
      dataSource.query(
        'INSERT INTO `page_access_rules` (`id`, `group_id`, `applies_to`, `actions`, `granted_by_id`) VALUES (?, ?, ?, ?, ?)',
        [
          randomUUID(),
          groupId,
          'subtree',
          JSON.stringify(['page.read']),
          granterId,
        ],
      ),
    ).resolves.toBeDefined();
  });

  it('cascades group deletion to its members, permissions and access rules', async () => {
    const groupId = await insertGroup(dataSource);
    const userId = await insertUser(dataSource);
    const granterId = await insertUser(dataSource);
    const ruleId = randomUUID();

    await dataSource.query(
      'INSERT INTO `group_members` (`group_id`, `user_id`) VALUES (?, ?)',
      [groupId, userId],
    );
    await dataSource.query(
      'INSERT INTO `group_permissions` (`group_id`, `permission`) VALUES (?, ?)',
      [groupId, 'tag.create'],
    );
    await dataSource.query(
      'INSERT INTO `page_access_rules` (`id`, `group_id`, `applies_to`, `actions`, `granted_by_id`) VALUES (?, ?, ?, ?, ?)',
      [ruleId, groupId, 'subtree', JSON.stringify(['page.read']), granterId],
    );

    await dataSource.query('DELETE FROM `groups` WHERE `id` = ?', [groupId]);

    const [members, permissions, rules] = await Promise.all([
      dataSource.query<unknown[]>(
        'SELECT * FROM `group_members` WHERE `group_id` = ?',
        [groupId],
      ),
      dataSource.query<unknown[]>(
        'SELECT * FROM `group_permissions` WHERE `group_id` = ?',
        [groupId],
      ),
      dataSource.query<unknown[]>(
        'SELECT * FROM `page_access_rules` WHERE `id` = ?',
        [ruleId],
      ),
    ]);
    expect(members).toHaveLength(0);
    expect(permissions).toHaveLength(0);
    expect(rules).toHaveLength(0);
  });

  it('cascades user deletion to their direct permissions and access rules', async () => {
    const userId = await insertUser(dataSource);
    const granterId = await insertUser(dataSource);
    const ruleId = randomUUID();

    await dataSource.query(
      'INSERT INTO `user_permissions` (`user_id`, `permission`) VALUES (?, ?)',
      [userId, 'tag.create'],
    );
    await dataSource.query(
      'INSERT INTO `page_access_rules` (`id`, `user_id`, `applies_to`, `actions`, `granted_by_id`) VALUES (?, ?, ?, ?, ?)',
      [ruleId, userId, 'subtree', JSON.stringify(['page.read']), granterId],
    );

    await dataSource.query('DELETE FROM `users` WHERE `id` = ?', [userId]);

    const [permissions, rules] = await Promise.all([
      dataSource.query<unknown[]>(
        'SELECT * FROM `user_permissions` WHERE `user_id` = ?',
        [userId],
      ),
      dataSource.query<unknown[]>(
        'SELECT * FROM `page_access_rules` WHERE `id` = ?',
        [ruleId],
      ),
    ]);
    expect(permissions).toHaveLength(0);
    expect(rules).toHaveLength(0);
  });

  it('cascades page deletion to rules and exclusions that target it', async () => {
    const granterId = await insertUser(dataSource);
    const userId = await insertUser(dataSource);
    const rootPageId = await insertPage(dataSource, granterId);
    const excludedPageId = await insertPage(dataSource, granterId);
    const ruleId = randomUUID();

    await dataSource.query(
      'INSERT INTO `page_access_rules` (`id`, `user_id`, `page_id`, `applies_to`, `actions`, `granted_by_id`) VALUES (?, ?, ?, ?, ?, ?)',
      [
        ruleId,
        userId,
        rootPageId,
        'subtree',
        JSON.stringify(['page.read']),
        granterId,
      ],
    );
    await dataSource.query(
      'INSERT INTO `page_access_exclusions` (`rule_id`, `page_id`) VALUES (?, ?)',
      [ruleId, excludedPageId],
    );

    await dataSource.query('DELETE FROM `pages` WHERE `id` = ?', [rootPageId]);

    const rules = await dataSource.query<unknown[]>(
      'SELECT * FROM `page_access_rules` WHERE `id` = ?',
      [ruleId],
    );
    expect(rules).toHaveLength(0);

    const exclusionsAfterRuleDelete = await dataSource.query<unknown[]>(
      'SELECT * FROM `page_access_exclusions` WHERE `rule_id` = ?',
      [ruleId],
    );
    expect(exclusionsAfterRuleDelete).toHaveLength(0);
  });

  it('cascades excluded-page deletion to its own exclusion rows', async () => {
    const granterId = await insertUser(dataSource);
    const userId = await insertUser(dataSource);
    const rootPageId = await insertPage(dataSource, granterId);
    const excludedPageId = await insertPage(dataSource, granterId);
    const ruleId = randomUUID();

    await dataSource.query(
      'INSERT INTO `page_access_rules` (`id`, `user_id`, `page_id`, `applies_to`, `actions`, `granted_by_id`) VALUES (?, ?, ?, ?, ?, ?)',
      [
        ruleId,
        userId,
        rootPageId,
        'subtree',
        JSON.stringify(['page.read']),
        granterId,
      ],
    );
    await dataSource.query(
      'INSERT INTO `page_access_exclusions` (`rule_id`, `page_id`) VALUES (?, ?)',
      [ruleId, excludedPageId],
    );

    await dataSource.query('DELETE FROM `pages` WHERE `id` = ?', [
      excludedPageId,
    ]);

    const exclusions = await dataSource.query<unknown[]>(
      'SELECT * FROM `page_access_exclusions` WHERE `rule_id` = ?',
      [ruleId],
    );
    expect(exclusions).toHaveLength(0);
  });

  it('defaults new users to is_active = true', async () => {
    const userId = await insertUser(dataSource);

    const [row] = await dataSource.query<{ is_active: number }[]>(
      'SELECT `is_active` FROM `users` WHERE `id` = ?',
      [userId],
    );
    expect(Boolean(row.is_active)).toBe(true);
  });
});
