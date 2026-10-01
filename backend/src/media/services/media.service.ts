import { randomUUID } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserActivityLogService } from '../../activity/services/user-activity-log.service.js';
import { AttachmentInUseException } from '../../common/exceptions/media/attachment-in-use.exception.js';
import { AttachmentNotFoundException } from '../../common/exceptions/media/attachment-not-found.exception.js';
import { FileTooLargeException } from '../../common/exceptions/media/file-too-large.exception.js';
import { StorageDeleteFailedException } from '../../common/exceptions/media/storage-delete-failed.exception.js';
import { UnsupportedFileTypeException } from '../../common/exceptions/media/unsupported-file-type.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import type { AuthenticatedUser } from '../../common/strategies/jwt.strategy.js';
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_LIMIT,
  MEDIA_PRESIGNED_URL_EXPIRY_SECONDS,
  UUID_REGEX,
} from '../../common/variables.global.js';
import { PagesService } from '../../pages/services/pages.service.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import { UsersService } from '../../users/services/users.service.js';
import type { StorageService } from '../../storage/services/storage.service.js';
import { ListMediaDto } from '../dto/in/list-media.dto.js';
import { UploadMediaDto } from '../dto/in/upload-media.dto.js';
import { Attachment } from '../entities/attachment.entity.js';
import type { AttachmentsRepository } from '../persistence/attachment.repository.js';

export interface UploadedMediaFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class MediaService {
  constructor(
    @Inject('AttachmentsRepository')
    private readonly attachmentsRepository: AttachmentsRepository,
    @Inject('StorageService')
    private readonly storageService: StorageService,
    @Inject('MediaBucket')
    private readonly bucket: string,
    private readonly pagesService: PagesService,
    private readonly permissionsService: PermissionsService,
    private readonly usersService: UsersService,
    private readonly userActivityLogService: UserActivityLogService,
  ) {}

  async uploadFile(
    file: UploadedMediaFile | undefined,
    dto: UploadMediaDto,
    uploadedById: string,
  ): Promise<{ attachment: Attachment; url: string }> {
    if (!file) {
      throw new ValidationException('No file provided');
    }

    this.validateUpload(file, dto);

    const pageId = dto.pageId ?? null;
    const minioKey = `pages/${pageId ?? 'unassigned'}/${randomUUID()}-${file.originalname}`;

    await this.storageService.upload(
      this.bucket,
      minioKey,
      file.buffer,
      file.mimetype,
    );

    const attachment = await this.attachmentsRepository.create({
      pageId,
      minioKey,
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedById,
    });

    const url = await this.storageService.getPresignedUrl(
      this.bucket,
      minioKey,
      MEDIA_PRESIGNED_URL_EXPIRY_SECONDS,
    );

    void this.userActivityLogService.record({
      userId: uploadedById,
      action: 'media.uploaded',
      targetType: 'attachment',
      targetId: attachment.id,
      metadata: { filename: file.originalname, pageId },
    });

    return { attachment, url };
  }

  async findAllByPage(
    pageId: string | undefined,
    currentUser?: AuthenticatedUser,
  ): Promise<{ attachment: Attachment; url: string }[]> {
    if (!pageId || !UUID_REGEX.test(pageId)) {
      throw new ValidationException('pageId must be a UUID');
    }

    await this.pagesService.getByIdOrFail(pageId, currentUser);

    const attachments =
      await this.attachmentsRepository.findAllByPageId(pageId);

    return Promise.all(
      attachments.map(async (attachment) => ({
        attachment,
        url: await this.storageService.getPresignedUrl(
          this.bucket,
          attachment.minioKey,
          MEDIA_PRESIGNED_URL_EXPIRY_SECONDS,
        ),
      })),
    );
  }

  async findLibrary(
    query: ListMediaDto,
    currentUser?: AuthenticatedUser,
  ): Promise<{
    items: { attachment: Attachment; url: string }[];
    total: number;
  }> {
    if (!currentUser) {
      throw new UnauthorizedException();
    }

    const page = MediaService.parsePage(query.page);
    const limit = MediaService.parseLimit(query.limit);
    const type = MediaService.parseType(query.type);
    const user = await this.usersService
      .findById(currentUser.id)
      .catch(() => undefined);
    const restrictToPublic =
      !(await this.permissionsService.hasUnrestrictedPageAccess(
        user,
        'page.read',
      ));

    const { items, total } = await this.attachmentsRepository.findLibrary({
      search: query.search?.trim() || undefined,
      type,
      page,
      limit,
      restrictToPublic,
    });

    const withUrls = await Promise.all(
      items.map(async (attachment) => ({
        attachment,
        url: await this.storageService.getPresignedUrl(
          this.bucket,
          attachment.minioKey,
          MEDIA_PRESIGNED_URL_EXPIRY_SECONDS,
        ),
      })),
    );

    return { items: withUrls, total };
  }

  async getPresignedUrl(
    id: string,
    currentUser?: AuthenticatedUser,
  ): Promise<{ url: string; expiresIn: number }> {
    if (!UUID_REGEX.test(id)) {
      throw new ValidationException('id must be a UUID');
    }

    const attachment = await this.attachmentsRepository.findById(id);
    if (!attachment) {
      throw new AttachmentNotFoundException();
    }

    if (attachment.pageId) {
      await this.pagesService.getByIdOrFail(attachment.pageId, currentUser);
    }

    const url = await this.storageService.getPresignedUrl(
      this.bucket,
      attachment.minioKey,
      MEDIA_PRESIGNED_URL_EXPIRY_SECONDS,
    );

    return { url, expiresIn: MEDIA_PRESIGNED_URL_EXPIRY_SECONDS };
  }

  async deleteAttachment(id: string, deletedById: string): Promise<void> {
    if (!UUID_REGEX.test(id)) {
      throw new ValidationException('id must be a UUID');
    }

    const attachment = await this.attachmentsRepository.findById(id);
    if (!attachment) {
      throw new AttachmentNotFoundException();
    }

    const referencingPages =
      await this.attachmentsRepository.findPagesReferencing(
        attachment.minioKey,
      );
    if (referencingPages.length > 0) {
      throw new AttachmentInUseException(
        referencingPages.map((page) => page.title),
      );
    }

    try {
      await this.storageService.delete(this.bucket, attachment.minioKey);
    } catch {
      throw new StorageDeleteFailedException();
    }

    await this.attachmentsRepository.delete(attachment.id);
    void this.userActivityLogService.record({
      userId: deletedById,
      action: 'media.deleted',
      targetType: 'attachment',
      targetId: id,
      metadata: { filename: attachment.filename },
    });
  }

  private validateUpload(file: UploadedMediaFile, dto: UploadMediaDto): void {
    if (dto.pageId !== undefined && !UUID_REGEX.test(dto.pageId)) {
      throw new ValidationException('pageId must be a UUID');
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new FileTooLargeException();
    }

    if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.mimetype)) {
      throw new UnsupportedFileTypeException();
    }
  }

  private static parsePage(raw?: number): number {
    return Number.isInteger(raw) && raw! > 0 ? raw! : DEFAULT_PAGE;
  }

  private static parseLimit(raw?: number): number {
    if (!Number.isInteger(raw) || raw! <= 0) {
      return DEFAULT_LIMIT;
    }
    return Math.min(raw!, MAX_LIMIT);
  }

  private static parseType(raw?: string): 'image' | 'file' | undefined {
    return raw === 'image' || raw === 'file' ? raw : undefined;
  }
}
