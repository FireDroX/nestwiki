import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { AdminAuditLogService } from '../../admin/services/admin-audit-log.service.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import { WebhookDeliveryNotFoundException } from '../../common/exceptions/webhooks/webhook-delivery-not-found.exception.js';
import { WebhookDisabledException } from '../../common/exceptions/webhooks/webhook-disabled.exception.js';
import { WebhookNotFoundException } from '../../common/exceptions/webhooks/webhook-not-found.exception.js';
import { PageReferenceService } from '../../pages/services/page-reference.service.js';
import { CreateWebhookDto } from '../dto/in/create-webhook.dto.js';
import { WebhookDelivery } from '../entities/webhook-delivery.entity.js';
import { Webhook } from '../entities/webhook.entity.js';
import type { WebhookDeliveryRepository } from '../persistence/webhook-delivery.repository.js';
import type {
  CreateWebhookInput,
  WebhookRepository,
} from '../persistence/webhook.repository.js';
import { WebhookDeliveryService } from './webhook-delivery.service.js';
import { WebhooksService } from './webhooks.service.js';

const SCOPE_PAGE_ID = '11111111-1111-4111-8111-111111111111';

function webhook(overrides: Partial<Webhook> = {}): Webhook {
  return {
    id: 'hook-1',
    name: 'n8n',
    url: 'https://n8n.local/hook',
    format: 'json',
    events: ['page.created'],
    secret: 'whsec_old',
    enabled: true,
    includePrivatePages: false,
    scopePageId: null,
    consecutiveFailures: 0,
    disabledReason: null,
    createdById: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const validDto: CreateWebhookDto = {
  name: 'n8n',
  url: 'http://192.168.1.20:5678/webhook/wiki',
  events: ['page.created', 'page.updated'],
};

describe('WebhooksService', () => {
  let service: WebhooksService;
  let webhooksRepository: {
    [K in keyof WebhookRepository]: Mock<WebhookRepository[K]>;
  };
  let deliveriesRepository: {
    findById: Mock<WebhookDeliveryRepository['findById']>;
    findByWebhook: Mock<WebhookDeliveryRepository['findByWebhook']>;
    findLatestByWebhook: Mock<WebhookDeliveryRepository['findLatestByWebhook']>;
  };
  let deliveryService: {
    sendTest: Mock<WebhookDeliveryService['sendTest']>;
    redeliver: Mock<WebhookDeliveryService['redeliver']>;
  };
  let pageReferenceService: {
    describe: Mock<PageReferenceService['describe']>;
  };
  let auditLog: { record: Mock };

  beforeEach(async () => {
    webhooksRepository = {
      findAll: vi.fn().mockResolvedValue([]),
      findEnabled: vi.fn(),
      findById: vi.fn().mockResolvedValue(webhook()),
      create: vi.fn((input: CreateWebhookInput) =>
        Promise.resolve(webhook({ ...input, id: 'new-hook' })),
      ),
      save: vi.fn((saved: Webhook) => Promise.resolve(saved)),
      delete: vi.fn().mockResolvedValue(undefined),
      resetFailures: vi.fn(),
      recordFailure: vi.fn(),
    };
    deliveriesRepository = {
      findById: vi.fn().mockResolvedValue(null),
      findByWebhook: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      findLatestByWebhook: vi.fn().mockResolvedValue(null),
    };
    deliveryService = {
      sendTest: vi.fn(),
      redeliver: vi.fn(),
    };
    pageReferenceService = {
      describe: vi.fn().mockResolvedValue({
        id: SCOPE_PAGE_ID,
        title: 'Docs',
        path: '/docs',
        visibility: 'public',
        ancestorIds: [],
        inTrash: false,
      }),
    };
    auditLog = { record: vi.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: 'WebhooksRepository', useValue: webhooksRepository },
        {
          provide: 'WebhookDeliveriesRepository',
          useValue: deliveriesRepository,
        },
        { provide: WebhookDeliveryService, useValue: deliveryService },
        { provide: PageReferenceService, useValue: pageReferenceService },
        { provide: AdminAuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = moduleRef.get(WebhooksService);
  });

  it('lists the webhooks with their latest delivery', async () => {
    const latest = { id: 'd1', status: 'failed' } as WebhookDelivery;
    webhooksRepository.findAll.mockResolvedValue([
      webhook(),
      webhook({ id: 'hook-2' }),
    ]);
    deliveriesRepository.findLatestByWebhook.mockImplementation((id) =>
      Promise.resolve(id === 'hook-1' ? latest : null),
    );

    const result = await service.list();

    expect(result.map((item) => item.lastDelivery)).toEqual([latest, null]);
    expect(result.map((item) => item.webhook.id)).toEqual(['hook-1', 'hook-2']);
  });

  describe('create', () => {
    it('creates an enabled json webhook with a generated secret and records it in the audit log', async () => {
      const created = await service.create(validDto, 'admin');

      const [[input]] = webhooksRepository.create.mock.calls;
      expect(input.secret).toMatch(/^whsec_/);
      expect(input).toEqual({
        name: 'n8n',
        url: 'http://192.168.1.20:5678/webhook/wiki',
        format: 'json',
        events: ['page.created', 'page.updated'],
        secret: input.secret,
        enabled: true,
        includePrivatePages: false,
        scopePageId: null,
        createdById: 'admin',
      });
      expect(auditLog.record).toHaveBeenCalledWith({
        adminId: 'admin',
        action: 'webhook.create',
        targetType: 'webhook',
        targetId: created.id,
        metadata: { name: 'n8n' },
      });
    });

    it('keeps each event once', async () => {
      await service.create(
        { ...validDto, events: ['page.created', 'page.created'] },
        'admin',
      );

      expect(webhooksRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ events: ['page.created'] }),
      );
    });

    it.each([
      ['an empty name', { name: ' ' }],
      ['a name over 100 characters', { name: 'x'.repeat(101) }],
      ['a URL that does not parse', { url: 'not a url' }],
      ['a non-http URL', { url: 'ftp://files.local/hook' }],
      ['no event', { events: [] }],
      ['an unknown event', { events: ['page.exploded'] }],
      ['an unknown format', { format: 'teams' }],
      ['a non-boolean includePrivatePages', { includePrivatePages: 'yes' }],
      ['a scope that is not a UUID', { scopePageId: 'docs' }],
    ])('rejects %s', async (_label, override) => {
      await expect(
        service.create(
          { ...validDto, ...override } as unknown as CreateWebhookDto,
          'admin',
        ),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(webhooksRepository.create).not.toHaveBeenCalled();
    });

    it('rejects a scope page that does not exist', async () => {
      pageReferenceService.describe.mockResolvedValue(null);

      await expect(
        service.create({ ...validDto, scopePageId: SCOPE_PAGE_ID }, 'admin'),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('accepts a scope page', async () => {
      await service.create(
        { ...validDto, scopePageId: SCOPE_PAGE_ID },
        'admin',
      );

      expect(webhooksRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ scopePageId: SCOPE_PAGE_ID }),
      );
    });
  });

  describe('update', () => {
    it('resets the failure counter and the reason when a disabled webhook is enabled again', async () => {
      webhooksRepository.findById.mockResolvedValue(
        webhook({
          enabled: false,
          consecutiveFailures: 20,
          disabledReason: 'Disabled after 20 consecutive failed deliveries',
        }),
      );

      const updated = await service.update(
        'hook-1',
        { enabled: true },
        'admin',
      );

      expect(updated).toMatchObject({
        enabled: true,
        consecutiveFailures: 0,
        disabledReason: null,
      });
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'webhook.update',
          targetId: 'hook-1',
        }),
      );
    });

    it('only changes the given fields', async () => {
      const updated = await service.update(
        'hook-1',
        { name: 'Discord', format: 'discord' },
        'admin',
      );

      expect(updated).toMatchObject({
        name: 'Discord',
        format: 'discord',
        url: 'https://n8n.local/hook',
        events: ['page.created'],
      });
    });

    it('validates the given fields', async () => {
      await expect(
        service.update('hook-1', { events: [] }, 'admin'),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws WebhookNotFoundException for an unknown webhook', async () => {
      webhooksRepository.findById.mockResolvedValue(null);

      await expect(
        service.update('missing', { name: 'x' }, 'admin'),
      ).rejects.toBeInstanceOf(WebhookNotFoundException);
    });
  });

  it('deletes a webhook and records it', async () => {
    await service.remove('hook-1', 'admin');

    expect(webhooksRepository.delete).toHaveBeenCalledWith('hook-1');
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'webhook.delete', targetId: 'hook-1' }),
    );
  });

  it('rotates the secret and records it', async () => {
    const rotated = await service.rotateSecret('hook-1', 'admin');

    expect(rotated.secret).toMatch(/^whsec_/);
    expect(rotated.secret).not.toBe('whsec_old');
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'webhook.rotate_secret',
        targetId: 'hook-1',
      }),
    );
  });

  it('sends a test through the delivery service', async () => {
    const result = { id: 'delivery' } as WebhookDelivery;
    deliveryService.sendTest.mockResolvedValue(result);

    await expect(service.sendTest('hook-1', 'admin')).resolves.toBe(result);
    expect(deliveryService.sendTest).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'hook-1' }),
      'admin',
    );
  });

  describe('deliveries', () => {
    it('lists the deliveries of a webhook, filtered by status', async () => {
      await service.listDeliveries('hook-1', {
        status: 'failed',
        page: '2',
        limit: '10',
      });

      expect(deliveriesRepository.findByWebhook).toHaveBeenCalledWith(
        'hook-1',
        'failed',
        2,
        10,
      );
    });

    it('rejects an unknown status', async () => {
      await expect(
        service.listDeliveries('hook-1', { status: 'lost' }),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('redelivers an existing delivery', async () => {
      const original = { id: 'd1', webhookId: 'hook-1' } as WebhookDelivery;
      deliveriesRepository.findById.mockResolvedValue(original);

      await service.redeliver('d1');

      expect(deliveryService.redeliver).toHaveBeenCalledWith(
        original,
        expect.objectContaining({ id: 'hook-1' }),
      );
    });

    it('refuses to redeliver for a disabled webhook', async () => {
      deliveriesRepository.findById.mockResolvedValue({
        id: 'd1',
        webhookId: 'hook-1',
      } as WebhookDelivery);
      webhooksRepository.findById.mockResolvedValue(
        webhook({ enabled: false }),
      );

      await expect(service.redeliver('d1')).rejects.toBeInstanceOf(
        WebhookDisabledException,
      );
      expect(deliveryService.redeliver).not.toHaveBeenCalled();
    });

    it('throws WebhookDeliveryNotFoundException for an unknown delivery', async () => {
      await expect(service.redeliver('missing')).rejects.toBeInstanceOf(
        WebhookDeliveryNotFoundException,
      );
    });
  });
});
