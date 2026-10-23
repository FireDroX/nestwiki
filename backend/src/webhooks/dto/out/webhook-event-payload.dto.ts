import type { WebhookDeliveredEvent } from '../../entities/webhook.entity.js';

export interface WebhookPageDto {
  id: string;
  title: string;
  path: string;
  url: string;
}

export interface WebhookEventDataDto {
  page?: WebhookPageDto;
  versionId?: string;
  changeSummary?: string | null;
  fromPath?: string;
  toPath?: string;
  descendantCount?: number;
  commentId?: string;
  pageCount?: number;
  createdCount?: number;
  updatedCount?: number;
  message?: string;
}

export interface WebhookActorDto {
  id: string;
  displayName: string;
}

export interface WebhookEventPayloadDto {
  id: string;
  event: WebhookDeliveredEvent;
  occurredAt: string;
  instance: { url: string; version: string };
  actor: WebhookActorDto | null;
  data: WebhookEventDataDto;
}
