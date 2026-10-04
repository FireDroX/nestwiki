import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Comment } from '../entities/comment.entity.js';
import {
  CommentsRepository,
  CreateCommentInput,
} from './comment.repository.js';

@Injectable()
export class TypeormCommentsRepository implements CommentsRepository {
  constructor(
    @InjectRepository(Comment)
    private readonly repository: Repository<Comment>,
  ) {}

  findById(id: string): Promise<Comment | null> {
    return this.repository.findOneBy({ id });
  }

  findAllByPageId(pageId: string): Promise<Comment[]> {
    return this.repository.find({
      where: { pageId },
      order: { createdAt: 'ASC' },
    });
  }

  findRepliesByParentId(parentId: string): Promise<Comment[]> {
    return this.repository.find({
      where: { parentId },
      order: { createdAt: 'ASC' },
    });
  }

  create(input: CreateCommentInput): Promise<Comment> {
    return this.repository.save(this.repository.create(input));
  }

  updateContent(
    comment: Comment,
    content: string,
    editedAt: Date,
  ): Promise<Comment> {
    const updated = this.repository.merge(comment, { content, editedAt });
    return this.repository.save(updated);
  }

  softDelete(comment: Comment): Promise<Comment> {
    const updated = this.repository.merge(comment, {
      content: '',
      deletedAt: new Date(),
    });
    return this.repository.save(updated);
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.repository.delete(ids);
  }

  async findAllByAuthorId(
    authorId: string,
    page: number,
    limit: number,
    excludeDeleted = false,
  ): Promise<{ items: Comment[]; total: number }> {
    const [items, total] = await this.repository.findAndCount({
      where: excludeDeleted ? { authorId, deletedAt: IsNull() } : { authorId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total };
  }

  async findAllIdsByAuthorId(authorId: string): Promise<string[]> {
    const rows = await this.repository.find({
      where: { authorId },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  findByIdsAndAuthorId(ids: string[], authorId: string): Promise<Comment[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.repository.findBy({ id: In(ids), authorId });
  }

  countByAuthorId(authorId: string): Promise<number> {
    return this.repository.count({
      where: { authorId, deletedAt: IsNull() },
    });
  }

  countByPageId(pageId: string): Promise<number> {
    return this.repository.count({
      where: { pageId, deletedAt: IsNull() },
    });
  }
}
