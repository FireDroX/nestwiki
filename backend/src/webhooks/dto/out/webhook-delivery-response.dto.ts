import type { WebhookDeliveryStatus } from '../../entities/webhook-delivery.entity.js';
import type { WebhookDeliveredEvent } from '../../entities/webhook.entity.js';

export interface WebhookDeliveryResponseDto {
  id: string;
  webhookId: string;
  event: WebhookDeliveredEvent;
  payload: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  nextAttemptAt: Date | null;
  lastStatusCode: number | null;
  lastError: string | null;
  durationMs: number | null;
  createdAt: Date;
  deliveredAt: Date | null;
}

export interface WebhookDeliveryListResponseDto {
  items: WebhookDeliveryResponseDto[];
  total: number;
}
