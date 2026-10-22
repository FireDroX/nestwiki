import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import { VersionCheckService } from '../../admin/services/version-check.service.js';
import type { PageReferenceDto } from '../../pages/dto/out/page-reference.dto.js';
import { UsersService } from '../../users/services/users.service.js';
import type { WebhookEventPayloadDto } from '../dto/out/webhook-event-payload.dto.js';
import { WebhookDelivery } from '../entities/webhook-delivery.entity.js';
import { Webhook } from '../entities/webhook.entity.js';
import type {
  CreateWebhookDeliveryInput,
  WebhookDeliveryRepository,
} from '../persistence/webhook-delivery.repository.js';
import type { WebhookRepository } from '../persistence/webhook.repository.js';
import { WebhookDeliveryService } from './webhook-delivery.service.js';
import { WebhookHttpClient } from './webhook-http.client.js';
import { WebhookSignature } from './webhook-signature.js';

const NOW = new Date('2026-10-21T10:00:00.000Z');
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function webhook(overrides: Partial<Webhook> = {}): Webhook {
  return {
    id: 'hook-1',
    name: 'n8n',
    url: 'https://n8n.local/webhook/wiki',
    format: 'json',
    events: ['page.updated'],
    secret: 'whsec_secret',
    enabled: true,
    includePrivatePages: false,
    scopePageId: null,
    consecutiveFailures: 0,
    disabledReason: null,
    createdById: 'admin',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function delivery(overrides: Partial<WebhookDelivery> = {}): WebhookDelivery {
  return {
    id: 'delivery-1',
    webhookId: 'hook-1',
    event: 'page.updated',
    payload: '{"event":"page.updated"}',
    status: 'pending',
    attempts: 0,
    nextAttemptAt: NOW,
    lastStatusCode: null,
    lastError: null,
    durationMs: null,
    createdAt: NOW,
    deliveredAt: null,
    ...overrides,
  };
}

const publicGuide: PageReferenceDto = {
  id: 'guide',
  title: 'Guide',
  path: '/docs/guide',
  visibility: 'public',
  ancestorIds: ['docs'],
  inTrash: false,
};

describe('WebhookDeliveryService', () => {
  let service: WebhookDeliveryService;
  let webhooksRepository: {
    findEnabled: Mock<WebhookRepository['findEnabled']>;
    findById: Mock<WebhookRepository['findById']>;
    save: Mock<WebhookRepository['save']>;
    resetFailures: Mock<WebhookRepository['resetFailures']>;
    recordFailure: Mock<WebhookRepository['recordFailure']>;
  };
  let deliveriesRepository: {
    [K in keyof WebhookDeliveryRepository]: Mock<WebhookDeliveryRepository[K]>;
  };
  let httpClient: { post: Mock<WebhookHttpClient['post']> };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    webhooksRepository = {
      findEnabled: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(webhook()),
      save: vi.fn((saved: Webhook) => Promise.resolve(saved)),
      resetFailures: vi.fn().mockResolvedValue(undefined),
      recordFailure: vi.fn().mockResolvedValue(false),
    };
    deliveriesRepository = {
      create: vi.fn((input: CreateWebhookDeliveryInput) =>
        Promise.resolve(delivery(input)),
      ),
      findById: vi.fn(),
      findDue: vi.fn().mockResolvedValue([]),
      findByWebhook: vi.fn(),
      findLatestByWebhooks: vi.fn(),
      save: vi.fn((saved: WebhookDelivery) => Promise.resolve(saved)),
      deleteCreatedBefore: vi.fn().mockResolvedValue(undefined),
    };
    httpClient = { post: vi.fn().mockResolvedValue(200) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WebhookDeliveryService,
        { provide: 'WebhooksRepository', useValue: webhooksRepository },
        {
          provide: 'WebhookDeliveriesRepository',
          useValue: deliveriesRepository,
        },
        { provide: WebhookHttpClient, useValue: httpClient },
        {
          provide: UsersService,
          useValue: {
            findById: vi.fn().mockResolvedValue({
              id: 'user-1',
              displayName: 'Adrien',
            }),
          },
        },
        {
          provide: VersionCheckService,
          useValue: { currentVersion: () => '1.3.3' },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockReturnValue('https://wiki.example.com/'),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(WebhookDeliveryService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('publish', () => {
    it('queues the event for the enabled webhooks that listen to it and whose filters match the page', async () => {
      webhooksRepository.findEnabled.mockResolvedValue([
        webhook({ id: 'all' }),
        webhook({ id: 'other-event', events: ['page.created'] }),
        webhook({ id: 'in-scope', scopePageId: 'docs' }),
        webhook({ id: 'the-page-itself', scopePageId: 'guide' }),
        webhook({ id: 'out-of-scope', scopePageId: 'faq' }),
      ]);

      await service.publish('page.updated', {
        actorId: 'user-1',
        page: publicGuide,
        data: { versionId: 'v2', changeSummary: 'Typo' },
      });

      expect(
        deliveriesRepository.create.mock.calls.map(
          ([input]) => input.webhookId,
        ),
      ).toEqual(['all', 'in-scope', 'the-page-itself']);
    });

    it('leaves private pages out unless the webhook includes them', async () => {
      webhooksRepository.findEnabled.mockResolvedValue([
        webhook({ id: 'public-only' }),
        webhook({ id: 'with-private', includePrivatePages: true }),
      ]);

      await service.publish('page.updated', {
        actorId: 'user-1',
        page: { ...publicGuide, visibility: 'private' },
        data: {},
      });

      expect(
        deliveriesRepository.create.mock.calls.map(
          ([input]) => input.webhookId,
        ),
      ).toEqual(['with-private']);
    });

    it('only sends events without a page to webhooks without a scope', async () => {
      webhooksRepository.findEnabled.mockResolvedValue([
        webhook({ id: 'all', events: ['pages.imported'] }),
        webhook({
          id: 'scoped',
          events: ['pages.imported'],
          scopePageId: 'docs',
        }),
      ]);

      await service.publish('pages.imported', {
        actorId: 'user-1',
        page: null,
        data: { pageCount: 12 },
      });

      expect(
        deliveriesRepository.create.mock.calls.map(
          ([input]) => input.webhookId,
        ),
      ).toEqual(['all']);
    });

    it('stores the payload, without any page content, and never sends it during the call', async () => {
      webhooksRepository.findEnabled.mockResolvedValue([webhook()]);

      await service.publish('page.updated', {
        actorId: 'user-1',
        page: publicGuide,
        data: { versionId: 'v2', changeSummary: 'Typo' },
      });

      expect(httpClient.post).not.toHaveBeenCalled();
      const [[input]] = deliveriesRepository.create.mock.calls;
      expect(input.nextAttemptAt).toEqual(NOW);
      const stored = JSON.parse(input.payload) as WebhookEventPayloadDto;
      expect(stored.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(stored).toEqual({
        id: stored.id,
        event: 'page.updated',
        occurredAt: NOW.toISOString(),
        instance: { url: 'https://wiki.example.com', version: '1.3.3' },
        actor: { id: 'user-1', displayName: 'Adrien' },
        data: {
          page: {
            id: 'guide',
            title: 'Guide',
            path: '/docs/guide',
            url: 'https://wiki.example.com/pages/docs/guide',
          },
          versionId: 'v2',
          changeSummary: 'Typo',
        },
      });
    });

    it('formats the payload for each webhook', async () => {
      webhooksRepository.findEnabled.mockResolvedValue([
        webhook({ id: 'discord', format: 'discord' }),
      ]);

      await service.publish('page.updated', {
        actorId: null,
        page: publicGuide,
        data: {},
      });

      const [[input]] = deliveriesRepository.create.mock.calls;
      const body = JSON.parse(input.payload) as {
        embeds: { title: string }[];
      };
      expect(body.embeds[0].title).toBe('Page modifiée : Guide');
    });
  });

  describe('hasSubscribers', () => {
    it('tells whether an enabled webhook listens to the event', async () => {
      webhooksRepository.findEnabled.mockResolvedValue([
        webhook({ events: ['page.created'] }),
      ]);

      await expect(service.hasSubscribers('page.created')).resolves.toBe(true);
      await expect(service.hasSubscribers('comment.created')).resolves.toBe(
        false,
      );
    });
  });

  describe('processDue', () => {
    it('posts the payload with signed headers and records the success', async () => {
      const due = delivery();
      deliveriesRepository.findDue.mockResolvedValue([due]);
      webhooksRepository.findById.mockResolvedValue(
        webhook({ consecutiveFailures: 3 }),
      );

      await service.processDue();

      const [[url, headers, body]] = httpClient.post.mock.calls;
      expect(url).toBe('https://n8n.local/webhook/wiki');
      expect(body).toBe(due.payload);
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'User-Agent': 'NestWiki/1.3.3',
        'X-NestWiki-Event': 'page.updated',
        'X-NestWiki-Delivery': 'delivery-1',
        'X-NestWiki-Timestamp': String(NOW.getTime() / 1000),
        'X-NestWiki-Signature': WebhookSignature.sign(
          'whsec_secret',
          String(NOW.getTime() / 1000),
          due.payload,
        ),
      });
      expect(deliveriesRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          attempts: 1,
          lastStatusCode: 200,
          deliveredAt: NOW,
          nextAttemptAt: null,
        }),
      );
      expect(webhooksRepository.resetFailures).toHaveBeenCalledWith('hook-1');
      expect(webhooksRepository.save).not.toHaveBeenCalled();
    });

    it('retries after 1 min, 5 min, 30 min, 2 h and 6 h, then gives up after 6 attempts', async () => {
      const due = delivery();
      deliveriesRepository.findDue.mockResolvedValue([due]);
      httpClient.post.mockResolvedValue(503);

      const delays: number[] = [];
      for (let attempt = 0; attempt < 6; attempt++) {
        await service.processDue();
        if (due.nextAttemptAt) {
          delays.push(due.nextAttemptAt.getTime() - NOW.getTime());
        }
      }

      expect(delays).toEqual([
        MINUTE,
        5 * MINUTE,
        30 * MINUTE,
        2 * HOUR,
        6 * HOUR,
      ]);
      expect(due).toMatchObject({
        status: 'failed',
        attempts: 6,
        lastStatusCode: 503,
        lastError: 'HTTP 503',
        nextAttemptAt: null,
      });
    });

    it('does not retry a 4xx answer, except 408 and 429', async () => {
      const notFound = delivery({ id: 'not-found' });
      const timeout = delivery({ id: 'timeout' });
      const throttled = delivery({ id: 'throttled' });
      deliveriesRepository.findDue.mockResolvedValue([
        notFound,
        timeout,
        throttled,
      ]);
      httpClient.post
        .mockResolvedValueOnce(404)
        .mockResolvedValueOnce(408)
        .mockResolvedValueOnce(429);

      await service.processDue();

      expect(notFound.status).toBe('failed');
      expect(timeout.status).toBe('pending');
      expect(throttled.status).toBe('pending');
    });

    it('fails a redirect at once, since redirects are not followed', async () => {
      const due = delivery();
      deliveriesRepository.findDue.mockResolvedValue([due]);
      httpClient.post.mockResolvedValue(301);

      await service.processDue();

      expect(due).toMatchObject({
        status: 'failed',
        attempts: 1,
        lastStatusCode: 301,
        lastError: 'HTTP 301: redirect not followed',
        nextAttemptAt: null,
      });
    });

    it('retries after a network error and keeps its message', async () => {
      const due = delivery();
      deliveriesRepository.findDue.mockResolvedValue([due]);
      httpClient.post.mockRejectedValue(new Error('connect ECONNREFUSED'));

      await service.processDue();

      expect(due).toMatchObject({
        status: 'pending',
        lastStatusCode: null,
        lastError: 'connect ECONNREFUSED',
      });
    });

    it('counts a failed delivery with a targeted update that disables the webhook after 20 in a row', async () => {
      deliveriesRepository.findDue.mockResolvedValue([
        delivery({ attempts: 5 }),
      ]);
      httpClient.post.mockResolvedValue(500);

      await service.processDue();

      expect(webhooksRepository.recordFailure).toHaveBeenCalledWith(
        'hook-1',
        20,
        'Disabled after 20 consecutive failed deliveries',
      );
      expect(webhooksRepository.save).not.toHaveBeenCalled();
    });

    it('fails the pending deliveries of a disabled webhook without sending them', async () => {
      const due = delivery();
      deliveriesRepository.findDue.mockResolvedValue([due]);
      webhooksRepository.findById.mockResolvedValue(
        webhook({ enabled: false }),
      );

      await service.processDue();

      expect(httpClient.post).not.toHaveBeenCalled();
      expect(due).toMatchObject({
        status: 'failed',
        lastError: 'Webhook disabled',
      });
    });

    it('purges the deliveries older than 30 days, at most once an hour', async () => {
      await service.processDue();
      await service.processDue();

      expect(deliveriesRepository.deleteCreatedBefore).toHaveBeenCalledTimes(1);
      expect(deliveriesRepository.deleteCreatedBefore).toHaveBeenCalledWith(
        new Date(NOW.getTime() - 30 * 24 * HOUR),
      );

      vi.setSystemTime(new Date(NOW.getTime() + HOUR));
      await service.processDue();

      expect(deliveriesRepository.deleteCreatedBefore).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendTest', () => {
    it('sends webhook.test right away, once, without counting a failure', async () => {
      const hook = webhook({ consecutiveFailures: 2 });
      httpClient.post.mockResolvedValue(500);

      const result = await service.sendTest(hook, 'user-1');

      expect(httpClient.post).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        event: 'webhook.test',
        status: 'failed',
        attempts: 1,
        lastStatusCode: 500,
      });
      expect(
        (JSON.parse(result.payload) as WebhookEventPayloadDto).data,
      ).toEqual({
        message: 'Ceci est un test envoyé depuis NestWiki.',
      });
      expect(hook.consecutiveFailures).toBe(2);
    });
  });

  describe('redeliver', () => {
    it('sends a copy of the delivery under a new id', async () => {
      const original = delivery({ id: 'old', status: 'failed', attempts: 6 });

      const copy = await service.redeliver(original, webhook());

      expect(copy.id).not.toBe('old');
      expect(copy).toMatchObject({
        event: original.event,
        payload: original.payload,
        status: 'success',
        attempts: 1,
      });
      expect(httpClient.post.mock.calls[0][1]['X-NestWiki-Delivery']).toBe(
        copy.id,
      );
    });

    it('creates the copy without a due date, so the background loop cannot send it too', async () => {
      await service.redeliver(delivery({ id: 'old' }), webhook());

      expect(deliveriesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ nextAttemptAt: null }),
      );
    });

    it('retries a failed copy and counts its final failure', async () => {
      httpClient.post.mockResolvedValue(503);

      const copy = await service.redeliver(delivery(), webhook());

      expect(copy).toMatchObject({ status: 'pending', attempts: 1 });
    });

    it('sends a copy of a test once, without retry or failure count', async () => {
      httpClient.post.mockResolvedValue(503);

      const copy = await service.redeliver(
        delivery({ event: 'webhook.test' }),
        webhook(),
      );

      expect(copy).toMatchObject({
        status: 'failed',
        attempts: 1,
        nextAttemptAt: null,
      });
      expect(webhooksRepository.recordFailure).not.toHaveBeenCalled();
    });
  });
});
