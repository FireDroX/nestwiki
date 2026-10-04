import { Inject, Injectable } from '@nestjs/common';
import { Change, diffLines } from 'diff';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto.js';
import { VersionNotFoundException } from '../../common/exceptions/pages/version-not-found.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import {
  CHANGE_SUMMARY_MAX_LENGTH,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  TITLE_MAX_LENGTH,
  UUID_REGEX,
} from '../../common/variables.global.js';
import { PageVersion } from '../../pages/entities/page-version.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import { ListVersionsQueryDto } from '../dto/in/list-versions-query.dto.js';
import {
  DiffChangeType,
  DiffResponseDto,
} from '../dto/out/diff-response.dto.js';
import type { VersionsRepository } from '../persistence/version.repository.js';

export interface ContributorInfo {
  id: string;
  displayName: string;
  hasAvatar: boolean;
}

@Injectable()
export class VersionsService {
  constructor(
    @Inject('VersionsRepository')
    private readonly versionsRepository: VersionsRepository,
    private readonly usersService: UsersService,
  ) {}

  async findAllByPage(
    pageId: string,
    query: ListVersionsQueryDto,
  ): Promise<PaginatedResponseDto<PageVersion>> {
    const page = VersionsService.parsePage(query.page);
    const limit = VersionsService.parseLimit(query.limit);
    const { items, total } = await this.versionsRepository.findAllByPageId(
      pageId,
      page,
      limit,
    );
    return { items, total, page, limit };
  }

  async getContributors(pageId: string): Promise<ContributorInfo[]> {
    const rows = await this.versionsRepository.findContributorsByPageId(pageId);
    const entries = await Promise.all(
      rows.map(async (row) => {
        try {
          const author = await this.usersService.findById(row.authorId);
          return {
            id: author.id,
            displayName: author.displayName,
            hasAvatar: author.avatarExtension !== null,
          };
        } catch {
          return null;
        }
      }),
    );
    return entries.filter((entry): entry is ContributorInfo => entry !== null);
  }

  countByPage(pageId: string): Promise<number> {
    return this.versionsRepository.countByPageId(pageId);
  }

  countContributors(pageId: string): Promise<number> {
    return this.versionsRepository.countContributorsByPageId(pageId);
  }

  async findOne(pageId: string, versionId: string): Promise<PageVersion> {
    const version = await this.versionsRepository.findByIdAndPageId(
      versionId,
      pageId,
    );
    if (!version) {
      throw new VersionNotFoundException();
    }
    return version;
  }

  async computeDiff(
    pageId: string,
    fromId?: string,
    toId?: string,
  ): Promise<DiffResponseDto> {
    this.validateDiffParams(fromId, toId);

    const [fromVersion, toVersion] = await Promise.all([
      this.versionsRepository.findByIdAndPageId(fromId!, pageId),
      this.versionsRepository.findByIdAndPageId(toId!, pageId),
    ]);
    if (!fromVersion || !toVersion) {
      throw new VersionNotFoundException();
    }

    const changes = diffLines(fromVersion.content, toVersion.content).map(
      (change) => ({
        type: VersionsService.resolveChangeType(change),
        value: change.value,
      }),
    );

    return { from: fromId!, to: toId!, changes };
  }

  createVersion(
    pageId: string,
    content: string,
    title: string,
    authorId: string,
    changeSummary?: string | null,
  ): Promise<PageVersion> {
    this.validate(title, content, changeSummary);

    return this.versionsRepository.create({
      pageId,
      content,
      title,
      authorId,
      changeSummary: changeSummary ?? null,
    });
  }

  private validate(
    title: string,
    content: string,
    changeSummary?: string | null,
  ): void {
    const errors: string[] = [];

    if (!title || title.length > TITLE_MAX_LENGTH) {
      errors.push(
        `title must be longer than or equal to 1 and shorter than or equal to ${TITLE_MAX_LENGTH} characters`,
      );
    }

    if (typeof content !== 'string') {
      errors.push('content must be a string');
    }

    if (
      changeSummary != null &&
      changeSummary.length > CHANGE_SUMMARY_MAX_LENGTH
    ) {
      errors.push(
        `changeSummary must be shorter than or equal to ${CHANGE_SUMMARY_MAX_LENGTH} characters`,
      );
    }

    if (errors.length > 0) {
      throw new ValidationException(errors.join(', '));
    }
  }

  private validateDiffParams(fromId?: string, toId?: string): void {
    const isValidUuid = (value?: string): boolean =>
      typeof value === 'string' && UUID_REGEX.test(value);

    if (!isValidUuid(fromId) || !isValidUuid(toId) || fromId === toId) {
      throw new ValidationException(
        'from and to must be different valid UUIDs',
      );
    }
  }

  private static resolveChangeType(change: Change): DiffChangeType {
    if (change.added) {
      return 'added';
    }
    if (change.removed) {
      return 'removed';
    }
    return 'unchanged';
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
