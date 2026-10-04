import { Comment } from '../entities/comment.entity.js';

export interface CreateCommentInput {
  pageId: string;
  authorId: string;
  parentId: string | null;
  content: string;
}

export interface CommentsRepository {
  findById(id: string): Promise<Comment | null>;
  findAllByPageId(pageId: string): Promise<Comment[]>;
  findRepliesByParentId(parentId: string): Promise<Comment[]>;
  create(input: CreateCommentInput): Promise<Comment>;
  updateContent(
    comment: Comment,
    content: string,
    editedAt: Date,
  ): Promise<Comment>;
  softDelete(comment: Comment): Promise<Comment>;
  deleteMany(ids: string[]): Promise<void>;
  findAllByAuthorId(
    authorId: string,
    page: number,
    limit: number,
    excludeDeleted?: boolean,
  ): Promise<{ items: Comment[]; total: number }>;
  findAllIdsByAuthorId(authorId: string): Promise<string[]>;
  findByIdsAndAuthorId(ids: string[], authorId: string): Promise<Comment[]>;
  countByAuthorId(authorId: string): Promise<number>;
  countByPageId(pageId: string): Promise<number>;
}
