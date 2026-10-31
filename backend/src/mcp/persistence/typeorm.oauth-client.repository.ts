import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuthClient } from '../entities/oauth-client.entity.js';
import {
  CreateOAuthClientInput,
  OAuthClientRepository,
} from './oauth-client.repository.js';

@Injectable()
export class TypeormOAuthClientRepository implements OAuthClientRepository {
  constructor(
    @InjectRepository(OAuthClient)
    private readonly repository: Repository<OAuthClient>,
  ) {}

  async create(data: CreateOAuthClientInput): Promise<OAuthClient> {
    return this.repository.save(this.repository.create(data));
  }

  findAll(): Promise<OAuthClient[]> {
    return this.repository.find({ order: { createdAt: 'DESC' } });
  }

  findById(id: string): Promise<OAuthClient | null> {
    return this.repository.findOneBy({ id });
  }

  findByClientId(clientId: string): Promise<OAuthClient | null> {
    return this.repository.findOneBy({ clientId });
  }

  async deleteWithoutTokensCreatedBefore(cutoff: Date): Promise<void> {
    await this.repository.query(
      'DELETE FROM `oauth_clients` WHERE `created_at` < ? AND NOT EXISTS (SELECT 1 FROM `oauth_refresh_tokens` WHERE `oauth_refresh_tokens`.`client_id` = `oauth_clients`.`id`)',
      [cutoff],
    );
  }
}
