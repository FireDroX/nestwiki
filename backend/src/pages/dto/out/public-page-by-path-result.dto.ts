import { Page } from '../../entities/page.entity.js';

export interface PublicPageByPathResultDto {
  page: Page;
  ancestors: Page[];
}
