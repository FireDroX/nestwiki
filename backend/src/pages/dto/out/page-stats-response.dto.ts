export interface PageStatsAuthorDto {
  id: string;
  displayName: string;
}

export interface PageStatsResponseDto {
  viewCount: number;
  lastModifiedAt: Date;
  lastModifiedBy: PageStatsAuthorDto | null;
  versionsCount: number;
  commentsCount: number;
  contributorsCount: number;
}
