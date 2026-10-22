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
