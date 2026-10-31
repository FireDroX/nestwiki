import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { UserActivityLogService } from '../../activity/services/user-activity-log.service.js';
import { AttachmentInUseException } from '../../common/exceptions/media/attachment-in-use.exception.js';
import { AttachmentNotFoundException } from '../../common/exceptions/media/attachment-not-found.exception.js';
import type { AuthenticatedUser } from '../../common/strategies/jwt.strategy.js';
import { PagesService } from '../../pages/services/pages.service.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import { UsersService } from '../../users/services/users.service.js';
import { Attachment } from '../entities/attachment.entity.js';
import type { AttachmentsRepository } from '../persistence/attachment.repository.js';
import { MediaService } from './media.service.js';

const ATTACHMENT_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ATTACHMENT_ID = '00000000-0000-4000-8000-000000000002';
const UPLOADER: AuthenticatedUser = {
  id: 'u1',
  email: 'u1@example.com',
  role: 'member',
};

function buildAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: ATTACHMENT_ID,
    pageId: null,
    minioKey: `pages/p1/${ATTACHMENT_ID}-image.png`,
    filename: 'image.png',
    mimeType: 'image/png',
    size: 1,
    uploadedById: 'u1',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('MediaService', () => {
  let service: MediaService;
  let attachmentsRepository: {
    findById: Mock<AttachmentsRepository['findById']>;
    findByIds: Mock<AttachmentsRepository['findByIds']>;
    findPagesReferencing: Mock<AttachmentsRepository['findPagesReferencing']>;
    assignUnattachedToPage: Mock<
      AttachmentsRepository['assignUnattachedToPage']
    >;
    assignToPage: Mock<AttachmentsRepository['assignToPage']>;
    delete: Mock<AttachmentsRepository['delete']>;
  };
  let storageService: {
    delete: ReturnType<typeof vi.fn>;
    download: ReturnType<typeof vi.fn>;
    getPresignedUrl: ReturnType<typeof vi.fn>;
  };
  let pagesService: { getByIdOrFail: ReturnType<typeof vi.fn> };
  let permissionsService: { can: Mock<PermissionsService['can']> };

  beforeEach(async () => {
    attachmentsRepository = {
      findById: vi.fn().mockResolvedValue(buildAttachment()),
      findByIds: vi.fn().mockResolvedValue([]),
      findPagesReferencing: vi.fn().mockResolvedValue([]),
      assignUnattachedToPage: vi.fn().mockResolvedValue(undefined),
      assignToPage: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    storageService = {
      delete: vi.fn().mockResolvedValue(undefined),
      download: vi.fn().mockResolvedValue(Buffer.from('png')),
      getPresignedUrl: vi.fn().mockResolvedValue('https://signed'),
    };
    pagesService = { getByIdOrFail: vi.fn().mockResolvedValue({}) };
    permissionsService = { can: vi.fn().mockResolvedValue(true) };

    const module = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: 'AttachmentsRepository', useValue: attachmentsRepository },
        { provide: 'StorageService', useValue: storageService },
        { provide: 'MediaBucket', useValue: 'bucket' },
        { provide: PagesService, useValue: pagesService },
        { provide: PermissionsService, useValue: permissionsService },
        {
          provide: UsersService,
          useValue: { findById: vi.fn().mockResolvedValue({ id: 'u1' }) },
        },
        {
          provide: UserActivityLogService,
          useValue: { record: vi.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(MediaService);
  });

  describe('deleteAttachment', () => {
    it('refuses to delete an attachment still used by a page, flagging pages in the trash', async () => {
      attachmentsRepository.findPagesReferencing.mockResolvedValue([
        { id: 'p1', title: 'Guide', inTrash: true },
        { id: 'p2', title: 'FAQ', inTrash: false },
      ]);

      const result = service.deleteAttachment(ATTACHMENT_ID, UPLOADER);

      await expect(result).rejects.toBeInstanceOf(AttachmentInUseException);
      await expect(result).rejects.toThrow(
        'Attachment is still referenced by: Guide (trash), FAQ',
      );
      expect(storageService.delete).not.toHaveBeenCalled();
      expect(attachmentsRepository.delete).not.toHaveBeenCalled();
    });

    it('looks for references with the whole attachment, so its id is searched', async () => {
      const attachment = buildAttachment();
      attachmentsRepository.findById.mockResolvedValue(attachment);

      await service.deleteAttachment(ATTACHMENT_ID, UPLOADER);

      expect(attachmentsRepository.findPagesReferencing).toHaveBeenCalledWith(
        attachment,
      );
    });

    it('names only the referencing pages the caller can read, and counts the others', async () => {
      attachmentsRepository.findPagesReferencing.mockResolvedValue([
        { id: 'p1', title: 'Secret project', inTrash: false },
        { id: 'p2', title: 'FAQ', inTrash: false },
      ]);
      permissionsService.can.mockImplementation((_user, _action, pageId) =>
        Promise.resolve(pageId === 'p2'),
      );

      const result = service.deleteAttachment(ATTACHMENT_ID, UPLOADER);

      await expect(result).rejects.toThrow(
        'Attachment is still referenced by: FAQ and 1 other page(s)',
      );
      await expect(result).rejects.not.toThrow(/Secret project/);
      expect(permissionsService.can).toHaveBeenCalledWith(
        { id: 'u1' },
        'page.read',
        'p1',
      );
      expect(storageService.delete).not.toHaveBeenCalled();
    });

    it('gives only a count when no referencing page is readable', async () => {
      attachmentsRepository.findPagesReferencing.mockResolvedValue([
        { id: 'p1', title: 'Secret project', inTrash: true },
      ]);
      permissionsService.can.mockResolvedValue(false);

      await expect(
        service.deleteAttachment(ATTACHMENT_ID, UPLOADER),
      ).rejects.toThrow('Attachment is still referenced by 1 page(s)');
    });

    it('deletes an attachment no page references', async () => {
      await service.deleteAttachment(ATTACHMENT_ID, UPLOADER);

      expect(storageService.delete).toHaveBeenCalledWith(
        'bucket',
        buildAttachment().minioKey,
      );
      expect(attachmentsRepository.delete).toHaveBeenCalledWith(ATTACHMENT_ID);
    });
  });

  describe('getPresignedUrl', () => {
    it('hides an attachment without a page from anonymous visitors', async () => {
      await expect(
        service.getPresignedUrl(ATTACHMENT_ID, undefined),
      ).rejects.toBeInstanceOf(AttachmentNotFoundException);
      expect(storageService.getPresignedUrl).not.toHaveBeenCalled();
    });

    it('hides an attachment without a page from other members', async () => {
      await expect(
        service.getPresignedUrl(ATTACHMENT_ID, { ...UPLOADER, id: 'u2' }),
      ).rejects.toBeInstanceOf(AttachmentNotFoundException);
    });

    it('lets the uploader and admins read an attachment without a page', async () => {
      await expect(
        service.getPresignedUrl(ATTACHMENT_ID, UPLOADER),
      ).resolves.toMatchObject({ url: 'https://signed' });
      await expect(
        service.getPresignedUrl(ATTACHMENT_ID, {
          id: 'admin',
          email: 'admin@example.com',
          role: 'admin',
        }),
      ).resolves.toMatchObject({ url: 'https://signed' });
    });

    it('checks the page of an attached media', async () => {
      attachmentsRepository.findById.mockResolvedValue(
        buildAttachment({ pageId: 'p1' }),
      );
      pagesService.getByIdOrFail.mockRejectedValueOnce(new Error('forbidden'));

      await expect(
        service.getPresignedUrl(ATTACHMENT_ID, UPLOADER),
      ).rejects.toThrow('forbidden');
      expect(pagesService.getByIdOrFail).toHaveBeenCalledWith('p1', UPLOADER);
    });
  });

  describe('attachUploadsReferencedBy', () => {
    it('attaches the author’s own unattached uploads embedded in the page', async () => {
      await service.attachUploadsReferencedBy(
        'page-1',
        `![a](http://localhost:3000/api/media/${ATTACHMENT_ID}/raw) ![b](/api/media/${OTHER_ATTACHMENT_ID.toUpperCase()}/raw) ![a again](/api/media/${ATTACHMENT_ID}/raw)`,
        'u1',
      );

      expect(attachmentsRepository.assignUnattachedToPage).toHaveBeenCalledWith(
        [ATTACHMENT_ID, OTHER_ATTACHMENT_ID],
        'page-1',
        'u1',
      );
    });
  });

  describe('releaseDetachedAttachments', () => {
    it('moves a media still used by another page to that page and deletes the unused ones', async () => {
      const reused = buildAttachment();
      const unused = buildAttachment({
        id: OTHER_ATTACHMENT_ID,
        minioKey: 'pages/p1/unused.png',
      });
      attachmentsRepository.findByIds.mockResolvedValue([reused, unused]);
      attachmentsRepository.findPagesReferencing.mockImplementation(
        (attachment) =>
          Promise.resolve(
            attachment.id === ATTACHMENT_ID
              ? [{ id: 'other-page', title: 'Other', inTrash: false }]
              : [],
          ),
      );

      await service.releaseDetachedAttachments([
        ATTACHMENT_ID,
        OTHER_ATTACHMENT_ID,
      ]);

      expect(attachmentsRepository.assignToPage).toHaveBeenCalledWith(
        ATTACHMENT_ID,
        'other-page',
      );
      expect(storageService.delete).toHaveBeenCalledTimes(1);
      expect(storageService.delete).toHaveBeenCalledWith(
        'bucket',
        'pages/p1/unused.png',
      );
      expect(attachmentsRepository.delete).toHaveBeenCalledWith(
        OTHER_ATTACHMENT_ID,
      );
    });

    it('keeps the row when the stored file could not be deleted', async () => {
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      attachmentsRepository.findByIds.mockResolvedValue([buildAttachment()]);
      storageService.delete.mockRejectedValueOnce(new Error('bucket offline'));

      await service.releaseDetachedAttachments([ATTACHMENT_ID]);

      expect(attachmentsRepository.delete).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(ATTACHMENT_ID));
      warn.mockRestore();
    });

    it('leaves alone an attachment that was given a page in the meantime', async () => {
      attachmentsRepository.findByIds.mockResolvedValue([
        buildAttachment({ pageId: 'p2' }),
      ]);

      await service.releaseDetachedAttachments([ATTACHMENT_ID]);

      expect(attachmentsRepository.findPagesReferencing).not.toHaveBeenCalled();
      expect(storageService.delete).not.toHaveBeenCalled();
    });
  });

  describe('findExportable', () => {
    it('checks access up front and downloads the file only when it is read', async () => {
      attachmentsRepository.findById.mockResolvedValue(
        buildAttachment({ pageId: 'p1' }),
      );

      const media = await service.findExportable(ATTACHMENT_ID);

      expect(pagesService.getByIdOrFail).toHaveBeenCalledWith('p1', undefined);
      expect(media?.filename).toBe('image.png');
      expect(storageService.download).not.toHaveBeenCalled();
      expect(await media?.read()).toEqual(Buffer.from('png'));
      expect(storageService.download).toHaveBeenCalledWith(
        'bucket',
        buildAttachment().minioKey,
      );
    });

    it('returns null for a missing media or one the caller may not read, without logging', async () => {
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      attachmentsRepository.findById.mockResolvedValueOnce(null);
      expect(await service.findExportable(ATTACHMENT_ID)).toBeNull();

      attachmentsRepository.findById.mockResolvedValue(
        buildAttachment({ pageId: 'p1' }),
      );
      pagesService.getByIdOrFail.mockRejectedValueOnce(new Error('forbidden'));
      expect(await service.findExportable(ATTACHMENT_ID)).toBeNull();
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('logs a storage failure and reads nothing', async () => {
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      storageService.download.mockRejectedValueOnce(
        new Error('bucket offline'),
      );

      const media = await service.findExportable(ATTACHMENT_ID, UPLOADER);

      expect(await media?.read()).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(ATTACHMENT_ID));
      warn.mockRestore();
    });

    it('exports an attachment without a page only for its uploader or an admin', async () => {
      expect(await service.findExportable(ATTACHMENT_ID)).toBeNull();
      expect(
        await service.findExportable(ATTACHMENT_ID, { ...UPLOADER, id: 'u2' }),
      ).toBeNull();
      expect(
        await service.findExportable(ATTACHMENT_ID, UPLOADER),
      ).not.toBeNull();
    });
  });
});
