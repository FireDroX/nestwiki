import type {
  WebhookEventName,
  WebhookFormat,
} from '../../entities/webhook.entity.js';

export class UpdateWebhookDto {
  name?: string;
  url?: string;
  format?: WebhookFormat;
  events?: WebhookEventName[];
  includePrivatePages?: boolean;
  scopePageId?: string | null;
  enabled?: boolean;
}
