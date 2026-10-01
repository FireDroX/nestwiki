import { Inject, Injectable } from '@nestjs/common';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '../../common/variables.global.js';
import type { AuthenticatedUser } from '../../common/strategies/jwt.strategy.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import { UsersService } from '../../users/services/users.service.js';
import { SearchQueryDto } from '../dto/in/search-query.dto.js';
import type {
  SearchMatch,
  SearchRepository,
} from '../persistence/search.repository.js';

const SEARCH_QUERY_MIN_LENGTH = 2;
const SEARCH_MAX_LIMIT = 50;

export interface SearchResult {
  items: SearchMatch[];
  total: number;
  q: string;
}

@Injectable()
export class SearchService {
  constructor(
    @Inject('SearchRepository')
    private readonly searchRepository: SearchRepository,
    private readonly permissionsService: PermissionsService,
    private readonly usersService: UsersService,
  ) {}

  async search(
    query: SearchQueryDto,
    currentUser?: AuthenticatedUser,
  ): Promise<SearchResult> {
    const q = SearchService.validateQuery(query.q);
    const page = SearchService.parsePage(query.page);
    const limit = SearchService.parseLimit(query.limit);
    const user = currentUser
      ? await this.usersService.findById(currentUser.id).catch(() => undefined)
      : undefined;
    const restrictToPublic =
      !(await this.permissionsService.hasUnrestrictedPageAccess(
        user,
        'page.read',
      ));

    const { items, total } = await this.searchRepository.search(
      q,
      page,
      limit,
      restrictToPublic,
    );

    return { items, total, q };
  }

  private static validateQuery(raw?: string): string {
    const q = raw?.trim() ?? '';
    if (q.length < SEARCH_QUERY_MIN_LENGTH) {
      throw new ValidationException(
        `q must be longer than or equal to ${SEARCH_QUERY_MIN_LENGTH} characters`,
      );
    }
    return q;
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
    return Math.min(parsed, SEARCH_MAX_LIMIT);
  }
}
