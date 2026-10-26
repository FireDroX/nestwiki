import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const WEBHOOK_FORMATS = ['json', 'discord', 'slack'] as const;
export type WebhookFormat = (typeof WEBHOOK_FORMATS)[number];

export const WEBHOOK_EVENTS = [
  'page.created',
  'page.updated',
  'page.moved',
  'page.deleted',
  'page.restored',
  'page.published',
  'comment.created',
  'pages.imported',
] as const;
export type WebhookEventName = (typeof WEBHOOK_EVENTS)[number];
export const WEBHOOK_TEST_EVENT = 'webhook.test';
export type WebhookDeliveredEvent =
  WebhookEventName | typeof WEBHOOK_TEST_EVENT;

@Entity('webhooks')
export class Webhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 2048 })
  url: string;

  @Column({ type: 'enum', enum: WEBHOOK_FORMATS, default: 'json' })
  format: WebhookFormat;

  @Column({ type: 'json' })
  events: WebhookEventName[];

  @Column({ type: 'varchar', length: 64 })
  secret: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'boolean', name: 'include_private_pages', default: false })
  includePrivatePages: boolean;

  @Column({
    type: 'varchar',
    length: 36,
    name: 'scope_page_id',
    nullable: true,
  })
  scopePageId: string | null;

  @Column({ type: 'int', name: 'consecutive_failures', default: 0 })
  consecutiveFailures: number;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'disabled_reason',
    nullable: true,
  })
  disabledReason: string | null;

  @Column({ type: 'varchar', length: 36, name: 'created_by_id' })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
