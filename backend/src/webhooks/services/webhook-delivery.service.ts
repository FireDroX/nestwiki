import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VersionCheckService } from '../../admin/services/version-check.service.js';
import {
  WEBHOOK_AUTO_DISABLE_THRESHOLD,
  WEBHOOK_DELIVERY_RETENTION_DAYS,
  WEBHOOK_DUE_BATCH_SIZE,
  WEBHOOK_ERROR_MAX_LENGTH,
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_POLL_INTERVAL_MS,
  WEBHOOK_PURGE_INTERVAL_MS,
  WEBHOOK_RETRY_DELAYS_MS,
} from '../../common/variables.global.js';
import type { PageReferenceDto } from '../../pages/dto/out/page-reference.dto.js';
import { UsersService } from '../../users/services/users.service.js';
import type {
  WebhookActorDto,
  WebhookEventDataDto,
  WebhookEventPayloadDto,
} from '../dto/out/webhook-event-payload.dto.js';
import { WebhookDelivery } from '../entities/webhook-delivery.entity.js';
import {
  Webhook,
  WEBHOOK_TEST_EVENT,
  type WebhookDeliveredEvent,
  type WebhookEventName,
} from '../entities/webhook.entity.js';
import { WebhookPayloadMapper } from '../mapper/webhook-payload.mapper.js';
import type { WebhookDeliveryRepository } from '../persistence/webhook-delivery.repository.js';
import type { WebhookRepository } from '../persistence/webhook.repository.js';
import { WebhookHttpClient } from './webhook-http.client.js';
import { WebhookSignature } from './webhook-signature.js';

const DAY_MS = 24 * 3_600_000;
const TEST_MESSAGE = 'Ceci est un test envoyé depuis NestWiki.';
const AUTO_DISABLED_REASON = `Disabled after ${WEBHOOK_AUTO_DISABLE_THRESHOLD} consecutive failed deliveries`;

export interface PublishedEvent {
  actorId: string | null;
  page: PageReferenceDto | null;
  data: Omit<WebhookEventDataDto, 'page'>;
}

type AttemptMode = 'scheduled' | 'once';

@Injectable()
export class WebhookDeliveryService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(WebhookDeliveryService.name);
  private readonly instanceUrl: string;
  private timer: NodeJS.Timeout | null = null;
  private processing: Promise<void> | null = null;
  private lastPurgeAt = 0;

  constructor(
    @Inject('WebhooksRepository')
    private readonly webhooksRepository: WebhookRepository,
    @Inject('WebhookDeliveriesRepository')
    private readonly deliveriesRepository: WebhookDeliveryRepository,
    private readonly httpClient: WebhookHttpClient,
    private readonly usersService: UsersService,
    private readonly versionCheckService: VersionCheckService,
    configService: ConfigService,
  ) {
    this.instanceUrl = (
      configService.get<string>('FRONTEND_URL') ?? ''
    ).replace(/\/+$/, '');
  }

  onApplicationBootstrap(): void {
    this.timer = setInterval(
      () => this.scheduleProcessing(),
      WEBHOOK_POLL_INTERVAL_MS,
    );
    this.timer.unref();
    this.scheduleProcessing();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async publish(
    event: WebhookEventName,
    published: PublishedEvent,
  ): Promise<void> {
    const webhooks = (await this.webhooksRepository.findEnabled()).filter(
      (webhook) =>
        webhook.events.includes(event) &&
        WebhookDeliveryService.matchesPage(webhook, published.page),
    );
    if (webhooks.length === 0) {
      return;
    }

    const payload = await this.buildPayload(event, published.actorId, {
      ...(published.page ? { page: this.toWebhookPage(published.page) } : {}),
      ...published.data,
    });
    for (const webhook of webhooks) {
      await this.deliveriesRepository.create({
        id: randomUUID(),
        webhookId: webhook.id,
        event,
        payload: WebhookPayloadMapper.toBody(webhook.format, payload),
        nextAttemptAt: new Date(),
      });
    }
    this.scheduleProcessing();
  }

  async sendTest(webhook: Webhook, actorId: string): Promise<WebhookDelivery> {
    const payload = await this.buildPayload(WEBHOOK_TEST_EVENT, actorId, {
      message: TEST_MESSAGE,
    });
    const created = await this.deliveriesRepository.create({
      id: randomUUID(),
      webhookId: webhook.id,
      event: WEBHOOK_TEST_EVENT,
      payload: WebhookPayloadMapper.toBody(webhook.format, payload),
      nextAttemptAt: null,
    });
    return this.attempt(created, webhook, 'once');
  }

  async redeliver(
    original: WebhookDelivery,
    webhook: Webhook,
  ): Promise<WebhookDelivery> {
    const copy = await this.deliveriesRepository.create({
      id: randomUUID(),
      webhookId: webhook.id,
      event: original.event,
      payload: original.payload,
      nextAttemptAt: new Date(),
    });
    return this.attempt(copy, webhook, 'scheduled');
  }

  async processDue(): Promise<void> {
    await this.purgeExpiredDeliveries();
    const due = await this.deliveriesRepository.findDue(
      new Date(),
      WEBHOOK_DUE_BATCH_SIZE,
    );
    for (const delivery of due) {
      const webhook = await this.webhooksRepository.findById(
        delivery.webhookId,
      );
      if (!webhook?.enabled) {
        await this.abandon(delivery);
        continue;
      }
      await this.attempt(delivery, webhook, 'scheduled');
    }
  }

  static matchesPage(webhook: Webhook, page: PageReferenceDto | null): boolean {
    if (!page) {
      return webhook.scopePageId === null;
    }
    if (page.visibility === 'private' && !webhook.includePrivatePages) {
      return false;
    }
    return (
      webhook.scopePageId === null ||
      webhook.scopePageId === page.id ||
      page.ancestorIds.includes(webhook.scopePageId)
    );
  }

  private scheduleProcessing(): void {
    setImmediate(() => {
      this.processing ??= this.processDue()
        .catch((error: unknown) =>
          this.logger.error(`Webhook deliveries failed: ${String(error)}`),
        )
        .finally(() => {
          this.processing = null;
        });
    });
  }

  private async attempt(
    delivery: WebhookDelivery,
    webhook: Webhook,
    mode: AttemptMode,
  ): Promise<WebhookDelivery> {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const startedAt = Date.now();
    let statusCode: number | null = null;
    let error: string | null = null;
    try {
      statusCode = await this.httpClient.post(
        webhook.url,
        this.buildHeaders(delivery, webhook, timestamp),
        delivery.payload,
      );
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }

    delivery.attempts += 1;
    delivery.durationMs = Date.now() - startedAt;
    delivery.lastStatusCode = statusCode;
    if (statusCode !== null && statusCode >= 200 && statusCode < 300) {
      delivery.status = 'success';
      delivery.deliveredAt = new Date();
      delivery.nextAttemptAt = null;
      delivery.lastError = null;
      if (mode === 'scheduled' && webhook.consecutiveFailures > 0) {
        webhook.consecutiveFailures = 0;
        await this.webhooksRepository.save(webhook);
      }
      return this.deliveriesRepository.save(delivery);
    }

    delivery.lastError = (error ?? `HTTP ${statusCode}`).slice(
      0,
      WEBHOOK_ERROR_MAX_LENGTH,
    );
    if (
      mode === 'scheduled' &&
      WebhookDeliveryService.isRetryable(statusCode) &&
      delivery.attempts < WEBHOOK_MAX_ATTEMPTS
    ) {
      delivery.status = 'pending';
      delivery.nextAttemptAt = new Date(
        Date.now() + WEBHOOK_RETRY_DELAYS_MS[delivery.attempts - 1],
      );
      return this.deliveriesRepository.save(delivery);
    }

    delivery.status = 'failed';
    delivery.nextAttemptAt = null;
    if (mode === 'scheduled') {
      await this.registerFailure(webhook);
    }
    return this.deliveriesRepository.save(delivery);
  }

  private async abandon(delivery: WebhookDelivery): Promise<void> {
    delivery.status = 'failed';
    delivery.nextAttemptAt = null;
    delivery.lastError = 'Webhook disabled';
    await this.deliveriesRepository.save(delivery);
  }

  private async registerFailure(webhook: Webhook): Promise<void> {
    webhook.consecutiveFailures += 1;
    if (webhook.consecutiveFailures >= WEBHOOK_AUTO_DISABLE_THRESHOLD) {
      webhook.enabled = false;
      webhook.disabledReason = AUTO_DISABLED_REASON;
      this.logger.warn(
        `Webhook ${webhook.id} disabled: ${AUTO_DISABLED_REASON}`,
      );
    }
    await this.webhooksRepository.save(webhook);
  }

  private async purgeExpiredDeliveries(): Promise<void> {
    const now = Date.now();
    if (now - this.lastPurgeAt < WEBHOOK_PURGE_INTERVAL_MS) {
      return;
    }
    this.lastPurgeAt = now;
    await this.deliveriesRepository.deleteCreatedBefore(
      new Date(now - WEBHOOK_DELIVERY_RETENTION_DAYS * DAY_MS),
    );
  }

  private buildHeaders(
    delivery: WebhookDelivery,
    webhook: Webhook,
    timestamp: string,
  ): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'User-Agent': `NestWiki/${this.versionCheckService.currentVersion()}`,
      'X-NestWiki-Event': delivery.event,
      'X-NestWiki-Delivery': delivery.id,
      'X-NestWiki-Timestamp': timestamp,
      'X-NestWiki-Signature': WebhookSignature.sign(
        webhook.secret,
        timestamp,
        delivery.payload,
      ),
    };
  }

  private async buildPayload(
    event: WebhookDeliveredEvent,
    actorId: string | null,
    data: WebhookEventDataDto,
  ): Promise<WebhookEventPayloadDto> {
    return {
      id: randomUUID(),
      event,
      occurredAt: new Date().toISOString(),
      instance: {
        url: this.instanceUrl,
        version: this.versionCheckService.currentVersion(),
      },
      actor: await this.resolveActor(actorId),
      data,
    };
  }

  private async resolveActor(
    actorId: string | null,
  ): Promise<WebhookActorDto | null> {
    if (!actorId) {
      return null;
    }
    try {
      const user = await this.usersService.findById(actorId);
      return { id: user.id, displayName: user.displayName };
    } catch {
      return null;
    }
  }

  private toWebhookPage(page: PageReferenceDto) {
    return {
      id: page.id,
      title: page.title,
      path: page.path,
      url: `${this.instanceUrl}/pages${page.path}`,
    };
  }

  private static isRetryable(statusCode: number | null): boolean {
    if (statusCode === null || statusCode === 408 || statusCode === 429) {
      return true;
    }
    return statusCode < 400 || statusCode >= 500;
  }
}
