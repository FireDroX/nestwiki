import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
