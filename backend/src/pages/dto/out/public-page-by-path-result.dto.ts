import { PageVersion } from '../../entities/page-version.entity.js';
import { Page } from '../../entities/page.entity.js';

export interface PublicPageByPathResultDto {
  page: Page;
  version: PageVersion;
  ancestors: Page[];
}
