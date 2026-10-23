import { Inject, Injectable } from '@nestjs/common';
import { AdminAuditLogService } from '../../admin/services/admin-audit-log.service.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import { WebhookDeliveryNotFoundException } from '../../common/exceptions/webhooks/webhook-delivery-not-found.exception.js';
import { WebhookDisabledException } from '../../common/exceptions/webhooks/webhook-disabled.exception.js';
import { WebhookNotFoundException } from '../../common/exceptions/webhooks/webhook-not-found.exception.js';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  UUID_REGEX,
  WEBHOOK_NAME_MAX_LENGTH,
  WEBHOOK_URL_MAX_LENGTH,
} from '../../common/variables.global.js';
import { PageReferenceService } from '../../pages/services/page-reference.service.js';
import { CreateWebhookDto } from '../dto/in/create-webhook.dto.js';
import { ListWebhookDeliveriesQueryDto } from '../dto/in/list-webhook-deliveries-query.dto.js';
import { UpdateWebhookDto } from '../dto/in/update-webhook.dto.js';
import {
  WEBHOOK_DELIVERY_STATUSES,
  WebhookDelivery,
  type WebhookDeliveryStatus,
} from '../entities/webhook-delivery.entity.js';
import {
  Webhook,
  WEBHOOK_EVENTS,
  WEBHOOK_FORMATS,
  type WebhookEventName,
  type WebhookFormat,
} from '../entities/webhook.entity.js';
import type {
  WebhookDeliveryRepository,
  WebhookDeliverySummary,
} from '../persistence/webhook-delivery.repository.js';
import type { WebhookRepository } from '../persistence/webhook.repository.js';
import { WebhookDeliveryService } from './webhook-delivery.service.js';
import { WebhookSignature } from './webhook-signature.js';

const HTTP_PROTOCOLS = ['http:', 'https:'];

export interface WebhookWithLastDelivery {
  webhook: Webhook;
  lastDelivery: WebhookDeliverySummary | null;
}

@Injectable()
export class WebhooksService {
  constructor(
    @Inject('WebhooksRepository')
    private readonly webhooksRepository: WebhookRepository,
    @Inject('WebhookDeliveriesRepository')
    private readonly deliveriesRepository: WebhookDeliveryRepository,
    private readonly deliveryService: WebhookDeliveryService,
    private readonly pageReferenceService: PageReferenceService,
    private readonly adminAuditLogService: AdminAuditLogService,
  ) {}

  async list(): Promise<WebhookWithLastDelivery[]> {
    const webhooks = await this.webhooksRepository.findAll();
    const latest = await this.deliveriesRepository.findLatestByWebhooks(
      webhooks.map((webhook) => webhook.id),
    );
    return webhooks.map((webhook) => ({
      webhook,
      lastDelivery: latest.get(webhook.id) ?? null,
    }));
  }

  async get(id: string): Promise<Webhook> {
    const webhook = await this.webhooksRepository.findById(id);
    if (!webhook) {
      throw new WebhookNotFoundException();
    }
    return webhook;
  }

  async create(dto: CreateWebhookDto, adminId: string): Promise<Webhook> {
    const name = WebhooksService.validateName(dto.name);
    const url = WebhooksService.validateUrl(dto.url);
    const format = WebhooksService.validateFormat(dto.format ?? 'json');
    const events = WebhooksService.validateEvents(dto.events);
    const includePrivatePages = WebhooksService.validateBoolean(
      'includePrivatePages',
      dto.includePrivatePages ?? false,
    );
    const enabled = WebhooksService.validateBoolean(
      'enabled',
      dto.enabled ?? true,
    );
    const scopePageId = await this.validateScope(dto.scopePageId ?? null);

    const webhook = await this.webhooksRepository.create({
      name,
      url,
      format,
      events,
      secret: WebhookSignature.generateSecret(),
      enabled,
      includePrivatePages,
      scopePageId,
      createdById: adminId,
    });
    await this.audit(adminId, 'webhook.create', webhook);
    return webhook;
  }

  async update(
    id: string,
    dto: UpdateWebhookDto,
    adminId: string,
  ): Promise<Webhook> {
    const webhook = await this.get(id);
    if (dto.name !== undefined) {
      webhook.name = WebhooksService.validateName(dto.name);
    }
    if (dto.url !== undefined) {
      webhook.url = WebhooksService.validateUrl(dto.url);
    }
    if (dto.format !== undefined) {
      webhook.format = WebhooksService.validateFormat(dto.format);
    }
    if (dto.events !== undefined) {
      webhook.events = WebhooksService.validateEvents(dto.events);
    }
    if (dto.includePrivatePages !== undefined) {
      webhook.includePrivatePages = WebhooksService.validateBoolean(
        'includePrivatePages',
        dto.includePrivatePages,
      );
    }
    if (dto.scopePageId !== undefined) {
      webhook.scopePageId = await this.validateScope(dto.scopePageId);
    }
    if (dto.enabled !== undefined) {
      const enabled = WebhooksService.validateBoolean('enabled', dto.enabled);
      if (enabled && !webhook.enabled) {
        webhook.consecutiveFailures = 0;
      }
      webhook.enabled = enabled;
      webhook.disabledReason = null;
    }

    const saved = await this.webhooksRepository.save(webhook);
    await this.audit(adminId, 'webhook.update', saved);
    return saved;
  }

  async remove(id: string, adminId: string): Promise<void> {
    const webhook = await this.get(id);
    await this.webhooksRepository.delete(webhook.id);
    await this.audit(adminId, 'webhook.delete', webhook);
  }

  async rotateSecret(id: string, adminId: string): Promise<Webhook> {
    const webhook = await this.get(id);
    webhook.secret = WebhookSignature.generateSecret();
    const saved = await this.webhooksRepository.save(webhook);
    await this.audit(adminId, 'webhook.rotate_secret', saved);
    return saved;
  }

  async sendTest(id: string, adminId: string): Promise<WebhookDelivery> {
    return this.deliveryService.sendTest(await this.get(id), adminId);
  }

  async listDeliveries(
    id: string,
    query: ListWebhookDeliveriesQueryDto,
  ): Promise<{ items: WebhookDelivery[]; total: number }> {
    const webhook = await this.get(id);
    return this.deliveriesRepository.findByWebhook(
      webhook.id,
      WebhooksService.parseStatus(query.status),
      WebhooksService.parsePage(query.page),
      WebhooksService.parseLimit(query.limit),
    );
  }

  async redeliver(deliveryId: string): Promise<WebhookDelivery> {
    const delivery = await this.deliveriesRepository.findById(deliveryId);
    if (!delivery) {
      throw new WebhookDeliveryNotFoundException();
    }
    const webhook = await this.get(delivery.webhookId);
    if (!webhook.enabled) {
      throw new WebhookDisabledException();
    }
    return this.deliveryService.redeliver(delivery, webhook);
  }

  private async validateScope(
    scopePageId: string | null,
  ): Promise<string | null> {
    if (scopePageId === null) {
      return null;
    }
    if (typeof scopePageId !== 'string' || !UUID_REGEX.test(scopePageId)) {
      throw new ValidationException('scopePageId must be a UUID');
    }
    if (!(await this.pageReferenceService.describe(scopePageId))) {
      throw new ValidationException(
        'scopePageId must reference an existing page',
      );
    }
    return scopePageId;
  }

  private async audit(
    adminId: string,
    action: string,
    webhook: Webhook,
  ): Promise<void> {
    await this.adminAuditLogService.record({
      adminId,
      action,
      targetType: 'webhook',
      targetId: webhook.id,
      metadata: { name: webhook.name },
    });
  }

  private static validateName(name: unknown): string {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed || trimmed.length > WEBHOOK_NAME_MAX_LENGTH) {
      throw new ValidationException(
        `name must be longer than or equal to 1 and shorter than or equal to ${WEBHOOK_NAME_MAX_LENGTH} characters`,
      );
    }
    return trimmed;
  }

  private static validateUrl(url: unknown): string {
    if (typeof url !== 'string' || url.length > WEBHOOK_URL_MAX_LENGTH) {
      throw new ValidationException('url must be a valid http(s) URL');
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new ValidationException('url must be a valid http(s) URL');
    }
    if (!HTTP_PROTOCOLS.includes(parsed.protocol)) {
      throw new ValidationException('url must be a valid http(s) URL');
    }
    return url;
  }

  private static validateFormat(format: unknown): WebhookFormat {
    if (!WEBHOOK_FORMATS.includes(format as WebhookFormat)) {
      throw new ValidationException(
        `format must be one of the following values: ${WEBHOOK_FORMATS.join(', ')}`,
      );
    }
    return format as WebhookFormat;
  }

  private static validateEvents(events: unknown): WebhookEventName[] {
    if (
      !Array.isArray(events) ||
      events.length === 0 ||
      !events.every((event) =>
        WEBHOOK_EVENTS.includes(event as WebhookEventName),
      )
    ) {
      throw new ValidationException(
        `events must contain at least one of the following values: ${WEBHOOK_EVENTS.join(', ')}`,
      );
    }
    return [...new Set(events as WebhookEventName[])];
  }

  private static validateBoolean(field: string, value: unknown): boolean {
    if (typeof value !== 'boolean') {
      throw new ValidationException(`${field} must be a boolean value`);
    }
    return value;
  }

  private static parseStatus(
    raw: string | undefined,
  ): WebhookDeliveryStatus | undefined {
    if (raw === undefined || raw === '') {
      return undefined;
    }
    if (!WEBHOOK_DELIVERY_STATUSES.includes(raw as WebhookDeliveryStatus)) {
      throw new ValidationException(
        `status must be one of the following values: ${WEBHOOK_DELIVERY_STATUSES.join(', ')}`,
      );
    }
    return raw as WebhookDeliveryStatus;
  }

  private static parsePage(raw?: string): number {
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_PAGE;
  }

  private static parseLimit(raw?: string): number {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return DEFAULT_LIMIT;
    }
    return Math.min(parsed, MAX_LIMIT);
  }
}
