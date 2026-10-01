import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { dataOf } from './support/api-response.js';
import { createTestApp } from './support/create-test-app.js';
import { resetDatabase } from './support/reset-database.js';

type HttpServer = Parameters<typeof request>[0];

interface PageResponse {
  id: string;
  currentVersion: { id: string; content: string };
}

interface PageUpdateResponse {
  content: string;
  currentVersionId: string;
}

interface VersionsPage {
  total: number;
}

const EDITORS_GROUP_NAME = 'Éditeurs';
const EDITORS_GLOBAL_PERMISSIONS = [
  'page.create_root',
  'tag.create',
  'tag.delete',
  'media.upload',
  'media.delete',
  'comment.moderate',
];
const EDITORS_WHOLE_WIKI_ACTIONS = [
  'page.read',
  'page.edit',
  'page.create_child',
  'page.delete',
  'page.move',
  'page.manage_visibility',
  'page.manage_tags',
  'page.restore_version',
];

async function joinEditorsGroup(
  dataSource: DataSource,
  userId: string,
): Promise<void> {
  const existing = await dataSource.query<{ id: string }[]>(
    'SELECT `id` FROM `groups` WHERE `name` = ?',
    [EDITORS_GROUP_NAME],
  );
  let groupId = existing[0]?.id;
  if (!groupId) {
    groupId = randomUUID();
    await dataSource.query(
      'INSERT INTO `groups` (`id`, `name`) VALUES (?, ?)',
      [groupId, EDITORS_GROUP_NAME],
    );
  }

  for (const permission of EDITORS_GLOBAL_PERMISSIONS) {
    await dataSource.query(
      'INSERT IGNORE INTO `group_permissions` (`group_id`, `permission`) VALUES (?, ?)',
      [groupId, permission],
    );
  }

  const wholeWikiRules = await dataSource.query<{ id: string }[]>(
    'SELECT `id` FROM `page_access_rules` WHERE `group_id` = ? AND `page_id` IS NULL',
    [groupId],
  );
  if (wholeWikiRules.length === 0) {
    await dataSource.query(
      "INSERT INTO `page_access_rules` (`id`, `group_id`, `page_id`, `applies_to`, `actions`, `granted_by_id`) VALUES (?, ?, NULL, 'subtree', ?, ?)",
      [
        randomUUID(),
        groupId,
        JSON.stringify(EDITORS_WHOLE_WIKI_ACTIONS),
        userId,
      ],
    );
  }

  await dataSource.query(
    'INSERT IGNORE INTO `group_members` (`group_id`, `user_id`) VALUES (?, ?)',
    [groupId, userId],
  );
}

async function registerEditor(
  app: INestApplication,
  dataSource: DataSource,
  email: string,
): Promise<request.Agent> {
  const password = 'Str0ng!Passw0rd';
  const agent = request.agent(app.getHttpServer() as HttpServer);

  await agent.post('/api/auth/register').send({
    email,
    password,
    displayName: 'Editor',
    turnstileToken: 'stubbed',
  });

  const [user] = await dataSource.query<{ id: string; role: string }[]>(
    'SELECT `id`, `role` FROM `users` WHERE `email` = ?',
    [email],
  );
  expect(user.role).toBe('member');
  await joinEditorsGroup(dataSource, user.id);

  await agent.post('/api/auth/login').send({
    email,
    password,
    turnstileToken: 'stubbed',
  });

  return agent;
}

describe('Pages (e2e)', () => {
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

  it('creates a page, edits it, then restores the original version', async () => {
    const agent = await registerEditor(app, dataSource, 'editor@example.com');

    const createResponse = await agent.post('/api/pages').send({
      slug: 'getting-started',
      title: 'Getting started',
      content: 'Original content',
      visibility: 'public',
    });

    expect(createResponse.status).toBe(201);
    const created = dataOf<PageResponse>(createResponse);
    const pageId = created.id;
    const firstVersionId = created.currentVersion.id;

    const editResponse = await agent.patch(`/api/pages/${pageId}`).send({
      content: 'Edited content',
      changeSummary: 'Clarify the intro',
    });

    expect(editResponse.status).toBe(200);
    const edited = dataOf<PageUpdateResponse>(editResponse);
    expect(edited.content).toBe('Edited content');
    const secondVersionId = edited.currentVersionId;
    expect(secondVersionId).not.toBe(firstVersionId);

    const afterEditVersions = await agent.get(`/api/pages/${pageId}/versions`);
    expect(dataOf<VersionsPage>(afterEditVersions).total).toBe(2);

    const restoreResponse = await agent.post(
      `/api/pages/${pageId}/versions/${firstVersionId}/restore`,
    );

    expect(restoreResponse.status).toBe(201);
    const restored = dataOf<PageUpdateResponse>(restoreResponse);
    expect(restored.content).toBe('Original content');
    const thirdVersionId = restored.currentVersionId;
    expect(thirdVersionId).not.toBe(firstVersionId);
    expect(thirdVersionId).not.toBe(secondVersionId);

    const afterRestoreVersions = await agent.get(
      `/api/pages/${pageId}/versions`,
    );
    expect(dataOf<VersionsPage>(afterRestoreVersions).total).toBe(3);

    const currentPage = await agent.get('/api/pages/getting-started');
    expect(dataOf<{ content: string }>(currentPage).content).toBe(
      'Original content',
    );
  });

  it('rejects root page creation from a plain member with 403', async () => {
    const agent = request.agent(app.getHttpServer() as HttpServer);
    await agent.post('/api/auth/register').send({
      email: 'reader@example.com',
      password: 'Str0ng!Passw0rd',
      displayName: 'Reader',
      turnstileToken: 'stubbed',
    });
    await agent.post('/api/auth/login').send({
      email: 'reader@example.com',
      password: 'Str0ng!Passw0rd',
      turnstileToken: 'stubbed',
    });

    const response = await agent.post('/api/pages').send({
      slug: 'blocked',
      title: 'Blocked',
      content: 'content',
      visibility: 'public',
    });

    expect(response.status).toBe(403);
  });
});
