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

  describe('trash', () => {
    async function createPage(
      agent: request.Agent,
      slug: string,
      parentId?: string,
    ): Promise<string> {
      const response = await agent.post('/api/pages').send({
        slug,
        title: slug,
        content: `Content of ${slug}`,
        visibility: 'public',
        parentId,
      });
      expect(response.status).toBe(201);
      return dataOf<PageResponse>(response).id;
    }

    async function registerAdmin(email: string): Promise<request.Agent> {
      const agent = request.agent(app.getHttpServer() as HttpServer);
      await agent.post('/api/auth/register').send({
        email,
        password: 'Str0ng!Passw0rd',
        displayName: 'Admin',
        turnstileToken: 'stubbed',
      });
      await dataSource.query(
        "UPDATE `users` SET `role` = 'admin' WHERE `email` = ?",
        [email],
      );
      await agent.post('/api/auth/login').send({
        email,
        password: 'Str0ng!Passw0rd',
        turnstileToken: 'stubbed',
      });
      return agent;
    }

    it('trashes a subtree, frees its slug and restores it with its children', async () => {
      const agent = await registerEditor(app, dataSource, 'editor@example.com');
      const docsId = await createPage(agent, 'docs');
      await createPage(agent, 'child', docsId);

      expect(
        (await agent.delete(`/api/pages/${docsId}?cascade=true`)).status,
      ).toBe(204);
      expect((await agent.get('/api/pages/docs/child')).status).toBe(404);

      const trash = dataOf<
        { id: string; path: string; descendantCount: number }[]
      >(await agent.get('/api/pages/trash'));
      expect(trash).toEqual([
        expect.objectContaining({
          id: docsId,
          path: '/docs',
          descendantCount: 1,
        }),
      ]);

      const replacementId = await createPage(agent, 'docs');
      const blocked = await agent.post(`/api/pages/${docsId}/restore`);
      expect(blocked.status).toBe(409);

      await agent.delete(`/api/pages/${replacementId}`);
      expect((await agent.post(`/api/pages/${docsId}/restore`)).status).toBe(
        204,
      );
      expect((await agent.get('/api/pages/docs/child')).status).toBe(200);
      expect(
        dataOf<{ id: string }[]>(await agent.get('/api/pages/trash')).map(
          (entry) => entry.id,
        ),
      ).toEqual([replacementId]);
    });

    it('refuses to restore a page whose parent is still in the trash', async () => {
      const agent = await registerEditor(app, dataSource, 'editor@example.com');
      const docsId = await createPage(agent, 'docs');
      const childId = await createPage(agent, 'child', docsId);

      await agent.delete(`/api/pages/${childId}`);
      await agent.delete(`/api/pages/${docsId}`);

      const response = await agent.post(`/api/pages/${childId}/restore`);
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: 'Restore the parent page first' });
    });

    it('purges a trashed subtree and keeps its media in the library', async () => {
      const admin = await registerAdmin('admin@example.com');
      const docsId = await createPage(admin, 'docs');
      const childId = await createPage(admin, 'child', docsId);
      const attachmentId = randomUUID();
      await dataSource.query(
        'INSERT INTO `attachments` (`id`, `page_id`, `minio_key`, `filename`, `mime_type`, `size`, `uploaded_by_id`) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          attachmentId,
          childId,
          `pages/${childId}/x-image.png`,
          'image.png',
          'image/png',
          1,
          docsId,
        ],
      );
      await admin.delete(`/api/pages/${childId}`);
      await admin.delete(`/api/pages/${docsId}`);

      expect((await admin.delete(`/api/pages/${docsId}/purge`)).status).toBe(
        204,
      );

      const remainingPages = await dataSource.query<{ id: string }[]>(
        'SELECT `id` FROM `pages` WHERE `id` IN (?, ?)',
        [docsId, childId],
      );
      expect(remainingPages).toEqual([]);
      const remainingVersions = await dataSource.query<{ id: string }[]>(
        'SELECT `id` FROM `page_versions` WHERE `page_id` IN (?, ?)',
        [docsId, childId],
      );
      expect(remainingVersions).toEqual([]);
      const [attachment] = await dataSource.query<{ page_id: string | null }[]>(
        'SELECT `page_id` FROM `attachments` WHERE `id` = ?',
        [attachmentId],
      );
      expect(attachment.page_id).toBeNull();
    });
  });
});
