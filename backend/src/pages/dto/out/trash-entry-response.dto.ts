export interface TrashEntryResponseDto {
  id: string;
  title: string;
  path: string;
  deletedAt: Date;
  deletedBy: { id: string; displayName: string } | null;
  descendantCount: number;
}
