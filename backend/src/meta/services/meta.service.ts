import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PageStatsService } from '../../pages/services/page-stats.service.js';
import { PagesService } from '../../pages/services/pages.service.js';
import { TagsService } from '../../tags/services/tags.service.js';
import {
  DEFAULT_META_DESCRIPTION,
  DEFAULT_META_ORIGIN,
  DEFAULT_META_TITLE,
  META_IMAGE_PATH,
  META_TITLE_SUFFIX,
} from '../constants/meta.constants.js';
import { PageCardDto } from '../dto/out/page-card.dto.js';
import { PageMetaDto } from '../dto/out/page-meta.dto.js';
import { PageCardMapper } from '../mapper/page-card.mapper.js';

@Injectable()
export class MetaService {
  constructor(
    private readonly pagesService: PagesService,
    private readonly pageStatsService: PageStatsService,
    private readonly tagsService: TagsService,
    private readonly configService: ConfigService,
  ) {}

  async getPageMeta(segments: string[]): Promise<PageMetaDto> {
    const origin = this.getOrigin();
    const imageUrl = `${origin}${META_IMAGE_PATH}`;

    const card = await this.buildPageCard(segments, origin);
    if (!card) {
      return {
        title: DEFAULT_META_TITLE,
        description: DEFAULT_META_DESCRIPTION,
        url: origin,
        imageUrl,
        discordEmbed: null,
      };
    }

    return {
      title: `${card.title}${META_TITLE_SUFFIX}`,
      description: PageCardMapper.toDescription(card),
      url: card.pageUrl,
      imageUrl,
      discordEmbed: PageCardMapper.toDiscordEmbed(card),
    };
  }

  private async buildPageCard(
    segments: string[],
    origin: string,
  ): Promise<PageCardDto | null> {
    const result = await this.pagesService.findPublicByPath(segments);
    if (!result) {
      return null;
    }

    const { page, version, ancestors } = result;
    const [stats, tags] = await Promise.all([
      this.pageStatsService.getStatsForPage(page, version),
      this.tagsService.listTagsOfAlreadyAuthorizedPage(page.id),
    ]);
    const encodedPath = segments.map(encodeURIComponent).join('/');

    return {
      title: page.title,
      ancestorTitles: ancestors.map((ancestor) => ancestor.title),
      tagNames: tags.map((tag) => tag.name),
      stats,
      pageUrl: `${origin}/pages/${encodedPath}`,
      editUrl: `${origin}/edit/${encodedPath}`,
    };
  }

  private getOrigin(): string {
    const origin =
      this.configService.get<string>('FRONTEND_URL') ?? DEFAULT_META_ORIGIN;
    return origin.replace(/\/+$/, '');
  }
}
