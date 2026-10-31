import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
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
  MEDIA_RAW_URL_PATTERN,
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
  private readonly logger = new Logger(MediaService.name);

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

  async storeImportedFile(file: {
    pageId: string;
    filename: string;
    mimeType: string;
    data: Buffer;
  }): Promise<string> {
    const minioKey = `pages/${file.pageId}/${randomUUID()}-${file.filename}`;
    await this.storageService.upload(
      this.bucket,
      minioKey,
      file.data,
      file.mimeType,
    );
    return minioKey;
  }

  async discardImportedFiles(minioKeys: string[]): Promise<void> {
    for (const minioKey of minioKeys) {
      await this.storageService
        .delete(this.bucket, minioKey)
        .catch((error: unknown) => {
          this.logger.warn(
            `Import rollback could not delete ${minioKey}: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
    }
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
    const readablePageIds =
      await this.permissionsService.getReadablePageIds(user);

    const { items, total } = await this.attachmentsRepository.findLibrary({
      search: query.search?.trim() || undefined,
      type,
      page,
      limit,
      readablePageIds,
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

    await this.assertReadable(attachment, currentUser);

    const url = await this.storageService.getPresignedUrl(
      this.bucket,
      attachment.minioKey,
      MEDIA_PRESIGNED_URL_EXPIRY_SECONDS,
    );

    return { url, expiresIn: MEDIA_PRESIGNED_URL_EXPIRY_SECONDS };
  }

  async findExportable(
    id: string,
    currentUser?: AuthenticatedUser,
  ): Promise<{ filename: string; read: () => Promise<Buffer | null> } | null> {
    const attachment = await this.attachmentsRepository.findById(id);
    if (!attachment) {
      return null;
    }
    const readable = await this.assertReadable(attachment, currentUser)
      .then(() => true)
      .catch(() => false);
    if (!readable) {
      return null;
    }
    return {
      filename: attachment.filename,
      read: () =>
        this.storageService
          .download(this.bucket, attachment.minioKey)
          .catch((error: unknown) => {
            this.logger.warn(
              `Export skipped media ${id}: ${error instanceof Error ? error.message : String(error)}`,
            );
            return null;
          }),
    };
  }

  async deleteAttachment(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    if (!UUID_REGEX.test(id)) {
      throw new ValidationException('id must be a UUID');
    }

    const attachment = await this.attachmentsRepository.findById(id);
    if (!attachment) {
      throw new AttachmentNotFoundException();
    }

    const referencingPages =
      await this.attachmentsRepository.findPagesReferencing(attachment);
    if (referencingPages.length > 0) {
      const readablePages = await this.filterReadablePages(
        referencingPages,
        currentUser,
      );
      throw new AttachmentInUseException(
        readablePages,
        referencingPages.length - readablePages.length,
      );
    }

    try {
      await this.storageService.delete(this.bucket, attachment.minioKey);
    } catch {
      throw new StorageDeleteFailedException();
    }

    await this.attachmentsRepository.delete(attachment.id);
    void this.userActivityLogService.record({
      userId: currentUser.id,
      action: 'media.deleted',
      targetType: 'attachment',
      targetId: id,
      metadata: { filename: attachment.filename },
    });
  }

  async attachUploadsReferencedBy(
    pageId: string,
    content: string,
    authorId: string,
  ): Promise<void> {
    const ids = [
      ...new Set(
        [...content.matchAll(MEDIA_RAW_URL_PATTERN)].map((match) =>
          match[1].toLowerCase(),
        ),
      ),
    ];
    await this.attachmentsRepository.assignUnattachedToPage(
      ids,
      pageId,
      authorId,
    );
  }

  async releaseDetachedAttachments(ids: string[]): Promise<void> {
    const attachments = await this.attachmentsRepository.findByIds(ids);
    for (const attachment of attachments.filter((item) => !item.pageId)) {
      const [referencingPage] =
        await this.attachmentsRepository.findPagesReferencing(attachment);
      if (referencingPage) {
        await this.attachmentsRepository.assignToPage(
          attachment.id,
          referencingPage.id,
        );
      } else {
        await this.deleteUnreferenced(attachment);
      }
    }
  }

  private async deleteUnreferenced(attachment: Attachment): Promise<void> {
    try {
      await this.storageService.delete(this.bucket, attachment.minioKey);
    } catch (error) {
      this.logger.warn(
        `Purge kept media ${attachment.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }
    await this.attachmentsRepository.delete(attachment.id);
  }

  private async assertReadable(
    attachment: Attachment,
    currentUser?: AuthenticatedUser,
  ): Promise<void> {
    if (attachment.pageId) {
      await this.pagesService.getByIdOrFail(attachment.pageId, currentUser);
      return;
    }
    const isUploaderOrAdmin =
      currentUser !== undefined &&
      (currentUser.role === 'admin' ||
        currentUser.id === attachment.uploadedById);
    if (!isUploaderOrAdmin) {
      throw new AttachmentNotFoundException();
    }
  }

  private async filterReadablePages<T extends { id: string }>(
    pages: T[],
    currentUser: AuthenticatedUser,
  ): Promise<T[]> {
    const user = await this.usersService
      .findById(currentUser.id)
      .catch(() => undefined);
    const readable = await Promise.all(
      pages.map((page) =>
        this.permissionsService.can(user, 'page.read', page.id),
      ),
    );
    return pages.filter((_page, index) => readable[index]);
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
