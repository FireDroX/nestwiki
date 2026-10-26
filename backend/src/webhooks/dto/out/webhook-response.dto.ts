import type { WebhookDeliveryStatus } from '../../entities/webhook-delivery.entity.js';
import type {
  WebhookEventName,
  WebhookFormat,
} from '../../entities/webhook.entity.js';

export interface WebhookResponseDto {
  id: string;
  name: string;
  url: string;
  format: WebhookFormat;
  events: WebhookEventName[];
  secret: string;
  enabled: boolean;
  includePrivatePages: boolean;
  scopePageId: string | null;
  consecutiveFailures: number;
  disabledReason: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookLastDeliveryDto {
  createdAt: Date;
  status: WebhookDeliveryStatus;
  lastStatusCode: number | null;
}

export interface WebhookSummaryResponseDto extends WebhookResponseDto {
  lastDelivery: WebhookLastDeliveryDto | null;
}
