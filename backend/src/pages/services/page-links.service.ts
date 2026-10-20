import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
} from '../../common/variables.global.js';
import { ListBrokenPageLinksQueryDto } from '../dto/in/list-broken-page-links-query.dto.js';
import {
  BrokenPageLinkDto,
  BrokenPageLinkListDto,
} from '../dto/out/broken-page-link-response.dto.js';
import type { PageLinkRepository } from '../persistence/page-link.repository.js';
import type { PagesRepository } from '../persistence/page.repository.js';
import { MarkdownLinkRewriter } from './markdown-link-rewriter.js';
import { PagePathIndex } from './page-path-index.js';

@Injectable()
export class PageLinksService {
  private readonly logger = new Logger(PageLinksService.name);
  private readonly instanceUrl: string;

  constructor(
    @Inject('PageLinksRepository')
    private readonly pageLinksRepository: PageLinkRepository,
    @Inject('PagesRepository')
    private readonly pagesRepository: PagesRepository,
    configService: ConfigService,
  ) {
    this.instanceUrl = (
      configService.get<string>('FRONTEND_URL') ?? ''
    ).replace(/\/+$/, '');
  }

  async syncPage(
    pageId: string,
    versionId: string,
    content: string,
  ): Promise<void> {
    try {
      await this.pageLinksRepository.replaceForPage(
        pageId,
        versionId,
        MarkdownLinkRewriter.findPagePaths(content, this.instanceUrl),
      );
    } catch (error) {
      this.logger.warn(
        `Links of page ${pageId} not indexed, retried at next startup: ${String(error)}`,
      );
    }
  }

  async findBrokenTargets(content: string): Promise<string[]> {
    const targets = MarkdownLinkRewriter.findPagePaths(
      content,
      this.instanceUrl,
    );
    if (targets.length === 0) {
      return [];
    }
    const index = new PagePathIndex(await this.pagesRepository.findAll());
    return targets.filter((target) => index.resolve(target) === undefined);
  }

  findLinkingPageIds(
    pagePath: string,
    includeDescendants: boolean,
  ): Promise<string[]> {
    return this.pageLinksRepository.findSourcePageIds(
      pagePath,
      includeDescendants,
    );
  }

  async listBroken(
    query: ListBrokenPageLinksQueryDto,
  ): Promise<BrokenPageLinkListDto> {
    const [pages, links] = await Promise.all([
      this.pagesRepository.findAll(),
      this.pageLinksRepository.findAllFromActiveSources(),
    ]);
    const index = new PagePathIndex(pages);
    const pagesById = new Map(pages.map((page) => [page.id, page]));

    const broken: BrokenPageLinkDto[] = [];
    for (const link of links) {
      const source = pagesById.get(link.sourcePageId);
      const sourcePath = index.pathOf(link.sourcePageId);
      if (
        source &&
        sourcePath !== undefined &&
        index.resolve(link.targetPath) === undefined
      ) {
        broken.push({
          sourcePage: { id: source.id, title: source.title, path: sourcePath },
          targetPath: link.targetPath,
        });
      }
    }
    broken.sort(
      (a, b) =>
        a.sourcePage.path.localeCompare(b.sourcePage.path) ||
        a.targetPath.localeCompare(b.targetPath),
    );

    const page = PageLinksService.parsePage(query.page);
    const limit = PageLinksService.parseLimit(query.limit);
    return {
      items: broken.slice((page - 1) * limit, page * limit),
      total: broken.length,
    };
  }

  private static parsePage(raw?: string): number {
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_PAGE;
  }

  private static parseLimit(raw?: string): number {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return DEFAULT_LIMIT;
    }
    return Math.min(parsed, MAX_LIMIT);
  }
}
