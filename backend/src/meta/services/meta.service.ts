import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Page } from '../../pages/entities/page.entity.js';
import { PagesService } from '../../pages/services/pages.service.js';
import {
  BREADCRUMB_SEPARATOR,
  DEFAULT_META_DESCRIPTION,
  DEFAULT_META_ORIGIN,
  DEFAULT_META_TITLE,
  DEFAULT_PAGE_META_DESCRIPTION,
  META_IMAGE_PATH,
  META_TITLE_SUFFIX,
} from '../constants/meta.constants.js';
import { PageMetaDto } from '../dto/out/page-meta.dto.js';

@Injectable()
export class MetaService {
  constructor(
    private readonly pagesService: PagesService,
    private readonly configService: ConfigService,
  ) {}

  async getPageMeta(segments: string[]): Promise<PageMetaDto> {
    const origin = this.getOrigin();
    const imageUrl = `${origin}${META_IMAGE_PATH}`;

    const result = await this.pagesService.findPublicByPath(segments);
    if (!result) {
      return {
        title: DEFAULT_META_TITLE,
        description: DEFAULT_META_DESCRIPTION,
        url: origin,
        imageUrl,
      };
    }

    const { page, ancestors } = result;
    return {
      title: `${page.title}${META_TITLE_SUFFIX}`,
      description: MetaService.buildDescription(page, ancestors),
      url: `${origin}/pages/${segments.map(encodeURIComponent).join('/')}`,
      imageUrl,
    };
  }

  private getOrigin(): string {
    const origin =
      this.configService.get<string>('FRONTEND_URL') ?? DEFAULT_META_ORIGIN;
    return origin.replace(/\/+$/, '');
  }

  private static buildDescription(page: Page, ancestors: Page[]): string {
    if (ancestors.length === 0) {
      return DEFAULT_PAGE_META_DESCRIPTION;
    }
    return [...ancestors, page]
      .map((entry) => entry.title)
      .join(BREADCRUMB_SEPARATOR);
  }
}
