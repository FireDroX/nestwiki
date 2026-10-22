import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, LessThanOrEqual, Repository } from 'typeorm';
import {
  WebhookDelivery,
  WebhookDeliveryStatus,
} from '../entities/webhook-delivery.entity.js';
import {
  CreateWebhookDeliveryInput,
  WebhookDeliveryRepository,
  WebhookDeliverySummary,
} from './webhook-delivery.repository.js';

@Injectable()
export class TypeormWebhookDeliveryRepository implements WebhookDeliveryRepository {
  constructor(
    @InjectRepository(WebhookDelivery)
    private readonly repository: Repository<WebhookDelivery>,
  ) {}

  create(input: CreateWebhookDeliveryInput): Promise<WebhookDelivery> {
    return this.repository.save(
      this.repository.create({ ...input, status: 'pending', attempts: 0 }),
    );
  }

  findById(id: string): Promise<WebhookDelivery | null> {
    return this.repository.findOneBy({ id });
  }

  findDue(now: Date, limit: number): Promise<WebhookDelivery[]> {
    return this.repository.find({
      where: { status: 'pending', nextAttemptAt: LessThanOrEqual(now) },
      order: { nextAttemptAt: 'ASC' },
      take: limit,
    });
  }

  async findByWebhook(
    webhookId: string,
    status: WebhookDeliveryStatus | undefined,
    page: number,
    limit: number,
  ): Promise<{ items: WebhookDelivery[]; total: number }> {
    const [items, total] = await this.repository.findAndCount({
      where: status ? { webhookId, status } : { webhookId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total };
  }

  async findLatestByWebhooks(
    webhookIds: string[],
  ): Promise<Map<string, WebhookDeliverySummary>> {
    const latest = new Map<string, WebhookDeliverySummary>();
    if (webhookIds.length === 0) {
      return latest;
    }
    const rows = await this.repository
      .createQueryBuilder('delivery')
      .select([
        'delivery.id',
        'delivery.webhookId',
        'delivery.createdAt',
        'delivery.status',
        'delivery.lastStatusCode',
      ])
      .innerJoin(
        (query) =>
          query
            .select('last.webhook_id', 'webhook_id')
            .addSelect('MAX(last.created_at)', 'created_at')
            .from(WebhookDelivery, 'last')
            .where('last.webhook_id IN (:...webhookIds)', { webhookIds })
            .groupBy('last.webhook_id'),
        'latest',
        'latest.webhook_id = delivery.webhook_id AND latest.created_at = delivery.created_at',
      )
      .getMany();
    for (const row of rows) {
      if (!latest.has(row.webhookId)) {
        latest.set(row.webhookId, row);
      }
    }
    return latest;
  }

  save(delivery: WebhookDelivery): Promise<WebhookDelivery> {
    return this.repository.save(delivery);
  }

  async deleteCreatedBefore(date: Date): Promise<void> {
    await this.repository.delete({ createdAt: LessThan(date) });
  }
}
