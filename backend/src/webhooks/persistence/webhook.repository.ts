import { Webhook } from '../entities/webhook.entity.js';

export type CreateWebhookInput = Pick<
  Webhook,
  | 'name'
  | 'url'
  | 'format'
  | 'events'
  | 'secret'
  | 'enabled'
  | 'includePrivatePages'
  | 'scopePageId'
  | 'createdById'
>;

export interface WebhookRepository {
  findAll(): Promise<Webhook[]>;
  findEnabled(): Promise<Webhook[]>;
  findById(id: string): Promise<Webhook | null>;
  create(input: CreateWebhookInput): Promise<Webhook>;
  save(webhook: Webhook): Promise<Webhook>;
  resetFailures(id: string): Promise<void>;
  recordFailure(
    id: string,
    threshold: number,
    reason: string,
  ): Promise<boolean>;
  delete(id: string): Promise<void>;
}
