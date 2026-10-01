import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PageAccessExclusion } from '../entities/page-access-exclusion.entity.js';
import { PageAccessRule } from '../entities/page-access-rule.entity.js';
import {
  CreatePageAccessRuleInput,
  PageAccessRulesRepository,
} from './page-access-rules.repository.js';

@Injectable()
export class TypeormPageAccessRulesRepository implements PageAccessRulesRepository {
  constructor(
    @InjectRepository(PageAccessRule)
    private readonly rules: Repository<PageAccessRule>,
    @InjectRepository(PageAccessExclusion)
    private readonly exclusions: Repository<PageAccessExclusion>,
  ) {}

  findByUserId(userId: string): Promise<PageAccessRule[]> {
    return this.rules.findBy({ userId });
  }

  findByGroupIds(groupIds: string[]): Promise<PageAccessRule[]> {
    if (groupIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.rules.findBy({ groupId: In(groupIds) });
  }

  findById(id: string): Promise<PageAccessRule | null> {
    return this.rules.findOneBy({ id });
  }

  create(input: CreatePageAccessRuleInput): Promise<PageAccessRule> {
    return this.rules.save(this.rules.create(input));
  }

  async updateActions(id: string, actions: string[]): Promise<void> {
    await this.rules.update(id, { actions });
  }

  async delete(id: string): Promise<void> {
    await this.rules.delete(id);
  }

  async findExclusions(ruleId: string): Promise<string[]> {
    const rows = await this.exclusions.findBy({ ruleId });
    return rows.map((row) => row.pageId);
  }

  async setExclusions(ruleId: string, pageIds: string[]): Promise<void> {
    await this.exclusions.delete({ ruleId });
    if (pageIds.length === 0) {
      return;
    }
    await this.exclusions.save(
      pageIds.map((pageId) => this.exclusions.create({ ruleId, pageId })),
    );
  }
}
