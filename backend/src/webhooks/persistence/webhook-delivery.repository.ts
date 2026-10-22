import {
  WebhookDelivery,
  WebhookDeliveryStatus,
} from '../entities/webhook-delivery.entity.js';

export type CreateWebhookDeliveryInput = Pick<
  WebhookDelivery,
  'id' | 'webhookId' | 'event' | 'payload' | 'nextAttemptAt'
>;

export interface WebhookDeliveryRepository {
  create(input: CreateWebhookDeliveryInput): Promise<WebhookDelivery>;
  findById(id: string): Promise<WebhookDelivery | null>;
  findDue(now: Date, limit: number): Promise<WebhookDelivery[]>;
  findByWebhook(
    webhookId: string,
    status: WebhookDeliveryStatus | undefined,
    page: number,
    limit: number,
  ): Promise<{ items: WebhookDelivery[]; total: number }>;
  findLatestByWebhook(webhookId: string): Promise<WebhookDelivery | null>;
  save(delivery: WebhookDelivery): Promise<WebhookDelivery>;
  deleteCreatedBefore(date: Date): Promise<void>;
}
