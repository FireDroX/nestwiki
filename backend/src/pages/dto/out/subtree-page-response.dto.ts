export interface SubtreePageResponseDto {
  id: string;
  title: string;
  slug: string;
  path: string;
  depth: number;
  content: string;
  tags: string[];
  updatedAt: Date;
}
