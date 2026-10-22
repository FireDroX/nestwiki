import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Webhook } from '../entities/webhook.entity.js';
import { CreateWebhookInput, WebhookRepository } from './webhook.repository.js';

@Injectable()
export class TypeormWebhookRepository implements WebhookRepository {
  constructor(
    @InjectRepository(Webhook)
    private readonly repository: Repository<Webhook>,
  ) {}

  findAll(): Promise<Webhook[]> {
    return this.repository.find({ order: { createdAt: 'ASC' } });
  }

  findEnabled(): Promise<Webhook[]> {
    return this.repository.findBy({ enabled: true });
  }

  findById(id: string): Promise<Webhook | null> {
    return this.repository.findOneBy({ id });
  }

  create(input: CreateWebhookInput): Promise<Webhook> {
    return this.repository.save(this.repository.create(input));
  }

  save(webhook: Webhook): Promise<Webhook> {
    return this.repository.save(webhook);
  }

  async resetFailures(id: string): Promise<void> {
    await this.repository.update({ id }, { consecutiveFailures: 0 });
  }

  async recordFailure(
    id: string,
    threshold: number,
    reason: string,
  ): Promise<boolean> {
    await this.repository.increment({ id }, 'consecutiveFailures', 1);
    const result = await this.repository.update(
      { id, enabled: true, consecutiveFailures: MoreThanOrEqual(threshold) },
      { enabled: false, disabledReason: reason },
    );
    return (result.affected ?? 0) > 0;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
