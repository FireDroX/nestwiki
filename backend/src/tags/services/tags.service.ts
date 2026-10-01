import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/strategies/jwt.strategy.js';
import { InsufficientPagePermissionException } from '../../common/exceptions/pages/insufficient-page-permission.exception.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import { UsersService } from '../../users/services/users.service.js';
import { PageTagAlreadyExistsException } from '../../common/exceptions/tags/page-tag-already-exists.exception.js';
import { PageTagNotFoundException } from '../../common/exceptions/tags/page-tag-not-found.exception.js';
import { TagAlreadyExistsException } from '../../common/exceptions/tags/tag-already-exists.exception.js';
import { TagNotFoundException } from '../../common/exceptions/tags/tag-not-found.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import {
  DEFAULT_TAG_COLOR,
  TAG_COLOR_REGEX,
  TAG_NAME_MAX_LENGTH,
} from '../../common/variables.global.js';
import { PagesService } from '../../pages/services/pages.service.js';
import { CreateTagDto } from '../dto/in/create-tag.dto.js';
import { PageTag } from '../entities/page-tag.entity.js';
import { Tag } from '../entities/tag.entity.js';
import type { TagRepository } from '../persistence/tag.repository.js';

@Injectable()
export class TagsService {
  constructor(
    @Inject('TagsRepository') private readonly tagRepository: TagRepository,
    private readonly pagesService: PagesService,
    private readonly permissionsService: PermissionsService,
    private readonly usersService: UsersService,
  ) {}

  async createTag(dto: CreateTagDto): Promise<Tag> {
    this.validateName(dto.name);
    const color = this.validateColor(dto.color);

    const existing = await this.tagRepository.findByName(dto.name);
    if (existing) {
      throw new TagAlreadyExistsException();
    }

    return this.tagRepository.create(dto.name, color);
  }

  listTags(): Promise<Tag[]> {
    return this.tagRepository.findAll();
  }

  async deleteTag(id: string): Promise<void> {
    const tag = await this.tagRepository.findById(id);
    if (!tag) {
      throw new TagNotFoundException();
    }
    await this.tagRepository.delete(id);
  }

  async tagPage(
    pageId: string,
    tagId: string,
    currentUser?: AuthenticatedUser,
  ): Promise<PageTag> {
    await this.pagesService.getByIdOrFail(pageId, currentUser);
    await this.assertCanManageTags(pageId, currentUser);

    const tag = await this.tagRepository.findById(tagId);
    if (!tag) {
      throw new TagNotFoundException();
    }

    const existing = await this.tagRepository.findPageTag(pageId, tagId);
    if (existing) {
      throw new PageTagAlreadyExistsException();
    }

    return this.tagRepository.createPageTag(pageId, tagId);
  }

  async untagPage(
    pageId: string,
    tagId: string,
    currentUser?: AuthenticatedUser,
  ): Promise<void> {
    await this.pagesService.getByIdOrFail(pageId, currentUser);
    await this.assertCanManageTags(pageId, currentUser);
    const existing = await this.tagRepository.findPageTag(pageId, tagId);
    if (!existing) {
      throw new PageTagNotFoundException();
    }
    await this.tagRepository.deletePageTag(pageId, tagId);
  }

  async listPageTags(
    pageId: string,
    currentUser?: AuthenticatedUser,
  ): Promise<Tag[]> {
    await this.pagesService.getByIdOrFail(pageId, currentUser);
    return this.tagRepository.findTagsByPageId(pageId);
  }

  private async assertCanManageTags(
    pageId: string,
    currentUser?: AuthenticatedUser,
  ): Promise<void> {
    const user = currentUser
      ? await this.usersService.findById(currentUser.id).catch(() => undefined)
      : undefined;
    if (
      !(await this.permissionsService.can(user, 'page.manage_tags', pageId))
    ) {
      throw new InsufficientPagePermissionException();
    }
  }

  private validateName(name: string): void {
    if (!name || name.length > TAG_NAME_MAX_LENGTH) {
      throw new ValidationException(
        `name must be longer than or equal to 1 and shorter than or equal to ${TAG_NAME_MAX_LENGTH} characters`,
      );
    }
  }

  private validateColor(color?: string): string {
    if (color === undefined) {
      return DEFAULT_TAG_COLOR;
    }
    if (!TAG_COLOR_REGEX.test(color)) {
      throw new ValidationException('color must be a hex color (ex. #3b82f6)');
    }
    return color;
  }
}
