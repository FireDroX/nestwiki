import { Injectable } from '@nestjs/common';
import { CommentsService } from '../../comments/services/comments.service.js';
import type { AuthenticatedUser } from '../../common/strategies/jwt.strategy.js';
import { UsersService } from '../../users/services/users.service.js';
import { VersionsService } from '../../versions/services/versions.service.js';
import {
  PageStatsAuthorDto,
  PageStatsResponseDto,
} from '../dto/out/page-stats-response.dto.js';
import { PagesService } from './pages.service.js';

@Injectable()
export class PageStatsService {
  constructor(
    private readonly pagesService: PagesService,
    private readonly versionsService: VersionsService,
    private readonly commentsService: CommentsService,
    private readonly usersService: UsersService,
  ) {}

  async getStatsById(
    id: string,
    currentUser?: AuthenticatedUser,
  ): Promise<PageStatsResponseDto> {
    const { page, version } =
      await this.pagesService.getReadableWithCurrentVersion(id, currentUser);

    const [versionsCount, commentsCount, contributorsCount, lastModifiedBy] =
      await Promise.all([
        this.versionsService.countByPage(page.id),
        this.commentsService.countByPage(page.id),
        this.versionsService.countContributors(page.id),
        this.findAuthor(version.authorId),
      ]);

    return {
      viewCount: page.viewCount,
      lastModifiedAt: version.createdAt,
      lastModifiedBy,
      versionsCount,
      commentsCount,
      contributorsCount,
    };
  }

  private async findAuthor(
    authorId: string,
  ): Promise<PageStatsAuthorDto | null> {
    try {
      const author = await this.usersService.findById(authorId);
      return { id: author.id, displayName: author.displayName };
    } catch {
      return null;
    }
  }
}
