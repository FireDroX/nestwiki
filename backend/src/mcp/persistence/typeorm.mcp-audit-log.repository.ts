import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { McpApiKey } from '../entities/mcp-api-key.entity.js';
import { McpAuditLog } from '../entities/mcp-audit-log.entity.js';
import { OAuthClient } from '../entities/oauth-client.entity.js';
import { OAUTH_AUDIT_KEY_PREFIX } from '../guards/mcp-oauth.guard.js';
import {
  CreateMcpAuditLogInput,
  McpAuditLogFilters,
  McpAuditLogRepository,
  McpAuditLogRow,
} from './mcp-audit-log.repository.js';

@Injectable()
export class TypeormMcpAuditLogRepository implements McpAuditLogRepository {
  constructor(
    @InjectRepository(McpAuditLog)
    private readonly repository: Repository<McpAuditLog>,
  ) {}

  async create(data: CreateMcpAuditLogInput): Promise<void> {
    await this.repository.save(this.repository.create(data));
  }

  async findAllPaginated(
    filters: McpAuditLogFilters,
    page: number,
    limit: number,
  ): Promise<{ items: McpAuditLogRow[]; total: number }> {
    const query = this.repository
      .createQueryBuilder('log')
      .leftJoin(McpApiKey, 'key', 'key.id = log.apiKeyId')
      .leftJoin(
        OAuthClient,
        'client',
        'log.apiKeyId = CONCAT(:oauthPrefix, client.id)',
        { oauthPrefix: OAUTH_AUDIT_KEY_PREFIX },
      )
      .select('log.id', 'id')
      .addSelect('COALESCE(key.name, client.name, log.apiKeyId)', 'apiKeyName')
      .addSelect('log.toolName', 'toolName')
      .addSelect('log.input', 'input')
      .addSelect('log.output', 'output')
      .addSelect('log.success', 'success')
      .addSelect('log.errorMessage', 'errorMessage')
      .addSelect('log.createdAt', 'createdAt')
      .orderBy('log.createdAt', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit);

    if (filters.apiKeyId) {
      query.andWhere('log.apiKeyId = :apiKeyId', {
        apiKeyId: filters.apiKeyId,
      });
    }
    if (filters.dateFrom) {
      query.andWhere('DATE(log.createdAt) >= :dateFrom', {
        dateFrom: filters.dateFrom,
      });
    }
    if (filters.dateTo) {
      query.andWhere('DATE(log.createdAt) <= :dateTo', {
        dateTo: filters.dateTo,
      });
    }
    if (filters.search) {
      const search = `%${filters.search}%`;
      query.andWhere(
        new Brackets((qb) => {
          qb.where('log.toolName LIKE :search', { search })
            .orWhere('key.name LIKE :search', { search })
            .orWhere('client.name LIKE :search', { search });
        }),
      );
    }

    const [items, total] = await Promise.all([
      query.getRawMany<McpAuditLogRow>(),
      query.getCount(),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        success: Boolean(item.success),
      })),
      total,
    };
  }
}
