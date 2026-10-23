import { MovedPageLinksDto } from './moved-page-links.dto.js';
import { PageResponseDto } from './page-response.dto.js';

export interface PageMoveResponseDto
  extends PageResponseDto, MovedPageLinksDto {}
