import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StorageService } from '../src/storage/services/storage.service.js';
import { dataOf } from './support/api-response.js';
import { createTestApp } from './support/create-test-app.js';
import { readZip } from './support/read-zip.js';
import { resetDatabase } from './support/reset-database.js';

type HttpServer = Parameters<typeof request>[0];

interface SubtreePage {
  id: string;
  path: string;
  depth: number;
  content: string;
  tags: string[];
}

interface PageFixture {
  docsId: string;
  guideId: string;
  secretId: string;
  hiddenId: string;
  apiId: string;
  publicMediaId: string;
  privateMediaId: string;
}

function binaryParser(
  response: request.Response,
  callback: (error: Error | null, body: Buffer) => void,
): void {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
}

describe('Export (e2e)', () => {
  let app: INestApplication;
  let close: () => Promise<void>;
  let dataSource: DataSource;
  let server: HttpServer;

  let admin: request.Agent;
  let tree: PageFixture;

  beforeAll(async () => {
    ({ app, close } = await createTestApp());
    dataSource = app.get(DataSource);
    server = app.getHttpServer() as HttpServer;
    admin = await registerAdmin();
    tree = await createTree(admin);
  });

  afterAll(async () => {
    await resetDatabase(dataSource);
    await close();
  });

  async function registerAdmin(): Promise<request.Agent> {
    const agent = request.agent(server);
    const credentials = {
      email: 'admin@example.com',
      password: 'Str0ng!Passw0rd',
      turnstileToken: 'stubbed',
    };
    await agent
      .post('/api/auth/register')
      .send({ ...credentials, displayName: 'Admin' });
    await dataSource.query(
      "UPDATE `users` SET `role` = 'admin' WHERE `email` = ?",
      [credentials.email],
    );
    await agent.post('/api/auth/login').send(credentials);
    return agent;
  }

  async function createPage(
    agent: request.Agent,
    slug: string,
    content: string,
    visibility: 'public' | 'private',
    parentId?: string,
  ): Promise<string> {
    const response = await agent.post('/api/pages').send({
      slug,
      title: `Title ${slug}`,
      content,
      visibility,
      parentId,
    });
    expect(response.status).toBe(201);
    return dataOf<{ id: string }>(response).id;
  }

  async function storeMedia(
    pageId: string,
    filename: string,
    bytes: string,
  ): Promise<string> {
    const id = randomUUID();
    const key = `pages/${pageId}/${id}-${filename}`;
    const storage = app.get<StorageService>('StorageService', {
      strict: false,
    });
    await storage.upload(
      process.env.MINIO_BUCKET ?? 'nestwiki',
      key,
      Buffer.from(bytes),
      'image/png',
    );
    const [user] = await dataSource.query<{ id: string }[]>(
      'SELECT `id` FROM `users` LIMIT 1',
    );
    await dataSource.query(
      'INSERT INTO `attachments` (`id`, `page_id`, `minio_key`, `filename`, `mime_type`, `size`, `uploaded_by_id`) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, pageId, key, filename, 'image/png', bytes.length, user.id],
    );
    return id;
  }

  async function createTree(admin: request.Agent): Promise<PageFixture> {
    const docsId = await createPage(admin, 'docs', 'Docs', 'public');
    const guideId = await createPage(
      admin,
      'guide',
      '[Back](/pages/docs) [Secret](/pages/docs/guide/secret)',
      'public',
      docsId,
    );
    const secretId = await createPage(
      admin,
      'secret',
      'Secret content',
      'private',
      guideId,
    );
    const hiddenId = await createPage(
      admin,
      'hidden',
      'Under a private page',
      'public',
      secretId,
    );
    const apiId = await createPage(admin, 'api', 'API', 'public', docsId);
    const publicMediaId = await storeMedia(docsId, 'diagram.png', 'public');
    const privateMediaId = await storeMedia(secretId, 'plan.png', 'private');
    await admin.patch(`/api/pages/${docsId}`).send({
      content: [
        '# Docs',
        '',
        '[Guide](/pages/docs/guide#intro)',
        `![public](/api/media/${publicMediaId}/raw)`,
        `![private](/api/media/${privateMediaId}/raw)`,
        '',
        '```md',
        '[Guide](/pages/docs/guide)',
        '```',
      ].join('\n'),
    });
    return {
      docsId,
      guideId,
      secretId,
      hiddenId,
      apiId,
      publicMediaId,
      privateMediaId,
    };
  }

  describe('GET /pages/:id/subtree-content', () => {
    it('returns the readable subtree in depth-first order and drops a private page with everything under it for an anonymous reader', async () => {
      const anonymous = await request(server).get(
        `/api/pages/${tree.docsId}/subtree-content`,
      );

      expect(anonymous.status).toBe(200);
      expect(
        dataOf<SubtreePage[]>(anonymous).map((page) => [page.path, page.depth]),
      ).toEqual([
        ['/docs', 0],
        ['/docs/guide', 1],
        ['/docs/api', 1],
      ]);
    });

    it('returns the whole subtree to a reader allowed to see every page', async () => {
      const response = await admin.get(
        `/api/pages/${tree.docsId}/subtree-content`,
      );

      expect(dataOf<SubtreePage[]>(response).map((page) => page.path)).toEqual([
        '/docs',
        '/docs/guide',
        '/docs/guide/secret',
        '/docs/guide/secret/hidden',
        '/docs/api',
      ]);
    });

    it('refuses a private root to an anonymous reader and answers 404 for an unknown page', async () => {
      expect(
        (
          await request(server).get(
            `/api/pages/${tree.secretId}/subtree-content`,
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await request(server).get(
            `/api/pages/${randomUUID()}/subtree-content`,
          )
        ).status,
      ).toBe(404);
    });
  });

  describe('GET /pages/:id/export', () => {
    it('downloads one page as Markdown with a YAML header and absolute wiki links', async () => {
      const response = await request(server).get(
        `/api/pages/${tree.guideId}/export`,
      );

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/markdown');
      expect(response.headers['content-disposition']).toBe(
        'attachment; filename="guide.md"',
      );
      const instanceUrl = (process.env.FRONTEND_URL ?? '').replace(/\/+$/, '');
      expect(response.text).toContain('title: "Title guide"');
      expect(response.text).toContain(
        `source: "${instanceUrl}/pages/docs/guide"`,
      );
      expect(response.text).toContain(
        `[Back](${instanceUrl}/pages/docs) [Secret](${instanceUrl}/pages/docs/guide/secret)`,
      );
    });

    it('builds a zip of the readable subtree with relative links and only the media the caller may read', async () => {
      const response = await request(server)
        .get(`/api/pages/${tree.docsId}/export?scope=subtree`)
        .buffer(true)
        .parse(binaryParser);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/zip');
      expect(response.headers['content-disposition']).toBe(
        'attachment; filename="docs.zip"',
      );
      const files = readZip(response.body as Buffer);
      expect([...files.keys()]).toEqual([
        'docs.md',
        'docs/guide.md',
        'docs/api.md',
        `_media/${tree.publicMediaId}-diagram.png`,
      ]);
      expect(
        files.get(`_media/${tree.publicMediaId}-diagram.png`)?.toString(),
      ).toBe('public');

      const instanceUrl = (process.env.FRONTEND_URL ?? '').replace(/\/+$/, '');
      const docs = files.get('docs.md')?.toString() ?? '';
      expect(docs).toContain('[Guide](docs/guide.md#intro)');
      expect(docs).toContain(
        `![public](_media/${tree.publicMediaId}-diagram.png)`,
      );
      expect(docs).toContain(
        `![private](${instanceUrl}/api/media/${tree.privateMediaId}/raw)`,
      );
      expect(docs).toContain('```md\n[Guide](/pages/docs/guide)\n```');
      expect(files.get('docs/guide.md')?.toString()).toContain(
        `[Back](../docs.md) [Secret](${instanceUrl}/pages/docs/guide/secret)`,
      );
    });

    it('includes private pages and their media for a caller allowed to read them', async () => {
      const response = await admin
        .get(`/api/pages/${tree.docsId}/export?scope=subtree`)
        .buffer(true)
        .parse(binaryParser);

      const files = readZip(response.body as Buffer);
      expect([...files.keys()]).toEqual([
        'docs.md',
        'docs/guide.md',
        'docs/guide/secret.md',
        'docs/guide/secret/hidden.md',
        'docs/api.md',
        `_media/${tree.publicMediaId}-diagram.png`,
        `_media/${tree.privateMediaId}-plan.png`,
      ]);
      expect(files.get('docs/guide.md')?.toString()).toContain(
        '[Secret](guide/secret.md)',
      );
    });

    it('rejects an unknown scope with 400 and a private page with 403 for an anonymous caller', async () => {
      const badScope = await request(server).get(
        `/api/pages/${tree.docsId}/export?scope=everything`,
      );
      expect(badScope.status).toBe(400);
      expect(badScope.body).toEqual({
        error: 'scope must be page or subtree',
      });

      expect(
        (
          await request(server).get(
            `/api/pages/${tree.secretId}/export?scope=subtree`,
          )
        ).status,
      ).toBe(403);
    });
  });
});
