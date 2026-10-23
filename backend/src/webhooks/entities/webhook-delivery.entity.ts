import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import type { WebhookDeliveredEvent } from './webhook.entity.js';

export const WEBHOOK_DELIVERY_STATUSES = [
  'pending',
  'success',
  'failed',
] as const;
export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number];

@Entity('webhook_deliveries')
@Index('IDX_webhook_deliveries_status_next_attempt', [
  'status',
  'nextAttemptAt',
])
@Index('IDX_webhook_deliveries_webhook_created', ['webhookId', 'createdAt'])
export class WebhookDelivery {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36, name: 'webhook_id' })
  webhookId: string;

  @Column({ type: 'varchar', length: 50 })
  event: WebhookDeliveredEvent;

  @Column({ type: 'mediumtext' })
  payload: string;

  @Column({ type: 'enum', enum: WEBHOOK_DELIVERY_STATUSES, default: 'pending' })
  status: WebhookDeliveryStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({
    type: 'datetime',
    precision: 6,
    name: 'next_attempt_at',
    nullable: true,
  })
  nextAttemptAt: Date | null;

  @Column({ type: 'int', name: 'last_status_code', nullable: true })
  lastStatusCode: number | null;

  @Column({
    type: 'varchar',
    length: 500,
    name: 'last_error',
    nullable: true,
  })
  lastError: string | null;

  @Column({ type: 'int', name: 'duration_ms', nullable: true })
  durationMs: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({
    type: 'datetime',
    precision: 6,
    name: 'delivered_at',
    nullable: true,
  })
  deliveredAt: Date | null;
}
