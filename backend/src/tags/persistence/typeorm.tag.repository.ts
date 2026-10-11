import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PageTag } from '../entities/page-tag.entity.js';
import { Tag } from '../entities/tag.entity.js';
import { TagRepository } from './tag.repository.js';

@Injectable()
export class TypeormTagRepository implements TagRepository {
  constructor(
    @InjectRepository(Tag) private readonly repository: Repository<Tag>,
    @InjectRepository(PageTag)
    private readonly pageTagRepository: Repository<PageTag>,
  ) {}

  findAll(): Promise<Tag[]> {
    return this.repository.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<Tag | null> {
    return this.repository.findOneBy({ id });
  }

  findByName(name: string): Promise<Tag | null> {
    return this.repository.findOneBy({ name });
  }

  async create(name: string, color: string): Promise<Tag> {
    return this.repository.save(this.repository.create({ name, color }));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  findPageTag(pageId: string, tagId: string): Promise<PageTag | null> {
    return this.pageTagRepository.findOneBy({ pageId, tagId });
  }

  async createPageTag(pageId: string, tagId: string): Promise<PageTag> {
    return this.pageTagRepository.save(
      this.pageTagRepository.create({ pageId, tagId }),
    );
  }

  async deletePageTag(pageId: string, tagId: string): Promise<void> {
    await this.pageTagRepository.delete({ pageId, tagId });
  }

  async findTagsByPageId(pageId: string): Promise<Tag[]> {
    const pageTags = await this.pageTagRepository.findBy({ pageId });
    if (pageTags.length === 0) {
      return [];
    }
    return this.repository.findBy({
      id: In(pageTags.map((pageTag) => pageTag.tagId)),
    });
  }

  async findTagNamesByPageIds(
    pageIds: string[],
  ): Promise<Map<string, string[]>> {
    const names = new Map<string, string[]>();
    if (pageIds.length === 0) {
      return names;
    }
    const pageTags = await this.pageTagRepository.findBy({
      pageId: In(pageIds),
    });
    if (pageTags.length === 0) {
      return names;
    }
    const tags = await this.repository.findBy({
      id: In([...new Set(pageTags.map((pageTag) => pageTag.tagId))]),
    });
    const namesById = new Map(tags.map((tag) => [tag.id, tag.name]));
    for (const { pageId, tagId } of pageTags) {
      const name = namesById.get(tagId);
      if (name) {
        names.set(pageId, [...(names.get(pageId) ?? []), name]);
      }
    }
    return names;
  }
}
