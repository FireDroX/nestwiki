import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PageVersion } from '../../pages/entities/page-version.entity.js';
import {
  ContributorRow,
  CreateVersionInput,
  FindAllByPageResult,
  VersionsRepository,
} from './version.repository.js';

@Injectable()
export class TypeormVersionsRepository implements VersionsRepository {
  constructor(
    @InjectRepository(PageVersion)
    private readonly repository: Repository<PageVersion>,
  ) {}

  async create(input: CreateVersionInput): Promise<PageVersion> {
    const version = this.repository.create(input);
    return this.repository.save(version);
  }

  async findAllByPageId(
    pageId: string,
    page: number,
    limit: number,
  ): Promise<FindAllByPageResult> {
    const [items, total] = await this.repository.findAndCount({
      where: { pageId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total };
  }

  findByIdAndPageId(id: string, pageId: string): Promise<PageVersion | null> {
    return this.repository.findOne({ where: { id, pageId } });
  }

  async findContributorsByPageId(pageId: string): Promise<ContributorRow[]> {
    const rows = await this.repository
      .createQueryBuilder('version')
      .select('version.authorId', 'authorId')
      .addSelect('MAX(version.createdAt)', 'lastContributedAt')
      .where('version.pageId = :pageId', { pageId })
      .groupBy('version.authorId')
      .orderBy('lastContributedAt', 'DESC')
      .getRawMany<{ authorId: string; lastContributedAt: Date }>();

    return rows.map((row) => ({
      authorId: row.authorId,
      lastContributedAt: new Date(row.lastContributedAt),
    }));
  }

  countByPageId(pageId: string): Promise<number> {
    return this.repository.count({ where: { pageId } });
  }

  async countContributorsByPageId(pageId: string): Promise<number> {
    const row = await this.repository
      .createQueryBuilder('version')
      .select('COUNT(DISTINCT version.authorId)', 'count')
      .where('version.pageId = :pageId', { pageId })
      .getRawOne<{ count: string | number }>();
    return Number(row?.count ?? 0);
  }
}
