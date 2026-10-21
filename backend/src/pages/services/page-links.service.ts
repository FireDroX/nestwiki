import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CHANGE_SUMMARY_MAX_LENGTH,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
} from '../../common/variables.global.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import type { User } from '../../users/entities/user.entity.js';
import { ListBrokenPageLinksQueryDto } from '../dto/in/list-broken-page-links-query.dto.js';
import {
  BrokenPageLinkDto,
  BrokenPageLinkListDto,
} from '../dto/out/broken-page-link-response.dto.js';
import { MovedPageLinksDto } from '../dto/out/moved-page-links.dto.js';
import {
  PAGE_VERSION_CREATED_EVENT,
  PageVersionCreatedEvent,
} from '../events/page-version-created.event.js';
import type { PageLinkRepository } from '../persistence/page-link.repository.js';
import type { PagesRepository } from '../persistence/page.repository.js';
import {
  MarkdownLinkRewriter,
  type PagePathMove,
} from './markdown-link-rewriter.js';
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
    private readonly permissionsService: PermissionsService,
    private readonly eventEmitter: EventEmitter2,
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

  async findBrokenTargets(
    content: string,
    reader: User | undefined,
  ): Promise<string[]> {
    const targets = MarkdownLinkRewriter.findPagePaths(
      content,
      this.instanceUrl,
    );
    if (targets.length === 0) {
      return [];
    }
    const pages = await this.pagesRepository.findAll();
    const index = new PagePathIndex(pages);
    const targetIds = new Set(
      targets.map((target) => index.resolve(target)).filter(Boolean),
    );
    const readableIds = new Set(
      (
        await this.permissionsService.filterReadable(
          reader,
          pages.filter((page) => targetIds.has(page.id)),
        )
      ).map((page) => page.id),
    );
    return targets.filter((target) => {
      const targetId = index.resolve(target);
      return targetId === undefined || !readableIds.has(targetId);
    });
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

  async rewriteAfterMove(
    move: PagePathMove,
    movedPageTitle: string,
    author: User,
  ): Promise<MovedPageLinksDto> {
    const result: MovedPageLinksDto = {
      linksUpdated: 0,
      pagesUpdated: 0,
      pagesSkipped: 0,
    };
    if (move.from === move.to) {
      return result;
    }

    const sourceIds = await this.pageLinksRepository.findSourcePageIds(
      move.from,
      true,
    );
    const actionsByPageId =
      await this.permissionsService.getEffectivePageActionsBulk(
        author,
        sourceIds,
      );
    const changeSummary =
      `Liens mis à jour après le déplacement de « ${movedPageTitle} »`.slice(
        0,
        CHANGE_SUMMARY_MAX_LENGTH,
      );

    for (const sourceId of sourceIds) {
      const page = await this.pagesRepository.findById(sourceId);
      const version = page?.currentVersionId
        ? await this.pagesRepository.findVersionById(page.currentVersionId)
        : null;
      if (!page || !version) {
        continue;
      }
      const rewritten = MarkdownLinkRewriter.movePagePaths(
        version.content,
        move,
        this.instanceUrl,
      );
      if (rewritten.linksUpdated === 0) {
        continue;
      }
      if (!(actionsByPageId.get(sourceId) ?? []).includes('page.edit')) {
        result.pagesSkipped += 1;
        continue;
      }

      const updated = await this.pagesRepository.updateWithNewVersion({
        page,
        title: page.title,
        content: rewritten.content,
        changeSummary,
        authorId: author.id,
      });
      await this.syncPage(
        updated.page.id,
        updated.version.id,
        updated.version.content,
      );
      this.eventEmitter.emit(
        PAGE_VERSION_CREATED_EVENT,
        new PageVersionCreatedEvent(
          updated.page.id,
          updated.version.id,
          author.id,
          updated.page.title,
          updated.version.content,
          changeSummary,
          updated.page.updatedAt,
        ),
      );
      result.linksUpdated += rewritten.linksUpdated;
      result.pagesUpdated += 1;
    }
    return result;
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
