import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto.js';
import { ResponseDto } from '../../common/dto/response.dto.js';
import type {
  AuthorInfo,
  UserCommentItem,
} from '../services/comments.service.js';
import { CommentResponseDto } from '../dto/out/comment-response.dto.js';
import { UserCommentResponseDto } from '../dto/out/user-comment-response.dto.js';
import { Comment } from '../entities/comment.entity.js';

export class CommentMapper {
  static toResponseDto(
    comment: Comment,
    authorNames: Map<string, AuthorInfo>,
  ): CommentResponseDto {
    const author = authorNames.get(comment.authorId);
    return {
      id: comment.id,
      pageId: comment.pageId,
      authorId: comment.authorId,
      authorDisplayName: author?.displayName ?? null,
      authorHasAvatar: author?.hasAvatar ?? false,
      parentId: comment.parentId,
      content: comment.content,
      editedAt: comment.editedAt,
      deletedAt: comment.deletedAt,
      createdAt: comment.createdAt,
    };
  }

  static toResponse(
    comment: Comment,
    authorNames: Map<string, AuthorInfo>,
  ): ResponseDto<CommentResponseDto> {
    return new ResponseDto(CommentMapper.toResponseDto(comment, authorNames));
  }

  static toTree(
    comments: Comment[],
    authorNames: Map<string, AuthorInfo>,
  ): CommentResponseDto[] {
    const topLevel = comments.filter((comment) => comment.parentId === null);
    return topLevel.map((comment) => ({
      ...CommentMapper.toResponseDto(comment, authorNames),
      replies: comments
        .filter((reply) => reply.parentId === comment.id)
        .map((reply) => CommentMapper.toResponseDto(reply, authorNames)),
    }));
  }

  static toTreeResponse(
    comments: Comment[],
    authorNames: Map<string, AuthorInfo>,
  ): ResponseDto<CommentResponseDto[]> {
    return new ResponseDto(CommentMapper.toTree(comments, authorNames));
  }

  static toUserCommentResponseDto({
    comment,
    pagePath,
    pageReadable,
  }: UserCommentItem): UserCommentResponseDto {
    return {
      id: comment.id,
      pageId: pageReadable ? comment.pageId : null,
      pagePath,
      content: pageReadable ? comment.content : null,
      deletedAt: comment.deletedAt,
      createdAt: comment.createdAt,
    };
  }

  static toPaginatedUserComments(
    items: UserCommentItem[],
    total: number,
    page: number,
    limit: number,
  ): ResponseDto<PaginatedResponseDto<UserCommentResponseDto>> {
    return new ResponseDto({
      items: items.map((item) => CommentMapper.toUserCommentResponseDto(item)),
      total,
      page,
      limit,
    });
  }
}
