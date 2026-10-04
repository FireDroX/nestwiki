import { PageStatsResponseDto } from '../../../pages/dto/out/page-stats-response.dto.js';

export interface PageCardDto {
  title: string;
  ancestorTitles: string[];
  tagNames: string[];
  stats: PageStatsResponseDto;
  pageUrl: string;
  editUrl: string;
}
