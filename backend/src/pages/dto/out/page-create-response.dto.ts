import { PageResponseDto } from './page-response.dto.js';

export interface PageCreateResponseDto extends PageResponseDto {
  brokenLinks: string[];
}
