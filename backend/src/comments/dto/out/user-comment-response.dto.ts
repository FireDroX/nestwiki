export interface UserCommentResponseDto {
  id: string;
  pageId: string | null;
  pagePath: string | null;
  content: string | null;
  deletedAt: Date | null;
  createdAt: Date;
}
