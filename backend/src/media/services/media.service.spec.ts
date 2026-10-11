import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { UserActivityLogService } from '../../activity/services/user-activity-log.service.js';
import { AttachmentInUseException } from '../../common/exceptions/media/attachment-in-use.exception.js';
import { PagesService } from '../../pages/services/pages.service.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import { UsersService } from '../../users/services/users.service.js';
import { Attachment } from '../entities/attachment.entity.js';
import type { AttachmentsRepository } from '../persistence/attachment.repository.js';
import { MediaService } from './media.service.js';

const ATTACHMENT_ID = '00000000-0000-4000-8000-000000000001';

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
    findPagesReferencing: Mock<AttachmentsRepository['findPagesReferencing']>;
    delete: Mock<AttachmentsRepository['delete']>;
  };
  let storageService: {
    delete: ReturnType<typeof vi.fn>;
    download: ReturnType<typeof vi.fn>;
  };
  let pagesService: { getByIdOrFail: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    attachmentsRepository = {
      findById: vi.fn().mockResolvedValue(buildAttachment()),
      findPagesReferencing: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    storageService = {
      delete: vi.fn().mockResolvedValue(undefined),
      download: vi.fn().mockResolvedValue(Buffer.from('png')),
    };
    pagesService = { getByIdOrFail: vi.fn().mockResolvedValue({}) };

    const module = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: 'AttachmentsRepository', useValue: attachmentsRepository },
        { provide: 'StorageService', useValue: storageService },
        { provide: 'MediaBucket', useValue: 'bucket' },
        { provide: PagesService, useValue: pagesService },
        { provide: PermissionsService, useValue: {} },
        { provide: UsersService, useValue: {} },
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

      const result = service.deleteAttachment(ATTACHMENT_ID, 'u1');

      await expect(result).rejects.toBeInstanceOf(AttachmentInUseException);
      await expect(result).rejects.toThrow(
        'Attachment is still referenced by: Guide (trash), FAQ',
      );
      expect(storageService.delete).not.toHaveBeenCalled();
      expect(attachmentsRepository.delete).not.toHaveBeenCalled();
    });

    it('deletes an attachment no page references', async () => {
      await service.deleteAttachment(ATTACHMENT_ID, 'u1');

      expect(storageService.delete).toHaveBeenCalledWith(
        'bucket',
        buildAttachment().minioKey,
      );
      expect(attachmentsRepository.delete).toHaveBeenCalledWith(ATTACHMENT_ID);
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

      const media = await service.findExportable(ATTACHMENT_ID);

      expect(await media?.read()).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(ATTACHMENT_ID));
      warn.mockRestore();
    });
  });
});
