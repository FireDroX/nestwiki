import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Attachment } from '../entities/attachment.entity.js';
import { TypeormAttachmentsRepository } from './typeorm.attachment.repository.js';

const ATTACHMENT_ID = '00000000-0000-4000-8000-000000000001';
const KEY_UUID = '11111111-1111-4111-8111-111111111111';

function buildAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: ATTACHMENT_ID,
    pageId: 'p1',
    minioKey: `pages/p1/${KEY_UUID}-image.png`,
    filename: 'image.png',
    mimeType: 'image/png',
    size: 1,
    uploadedById: 'u1',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('TypeormAttachmentsRepository', () => {
  let repository: TypeormAttachmentsRepository;
  let ormRepository: { update: ReturnType<typeof vi.fn> };
  let dataSource: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    ormRepository = { update: vi.fn() };
    dataSource = { query: vi.fn().mockResolvedValue([]) };
    repository = new TypeormAttachmentsRepository(
      ormRepository as never,
      dataSource as never,
    );
  });

  describe('findPagesReferencing', () => {
    it('searches the stable /media/<id>/raw URL and the legacy key UUID', async () => {
      await repository.findPagesReferencing(buildAttachment());

      const [sql, parameters] = dataSource.query.mock.calls[0] as [
        string,
        string[],
      ];
      expect(parameters).toEqual([
        `%/media/${ATTACHMENT_ID}/raw%`,
        `%${KEY_UUID}%`,
      ]);
      expect(sql).toContain('pv.content LIKE ? OR pv.content LIKE ?');
    });

    it('searches only the attachment id when the key has no UUID', async () => {
      await repository.findPagesReferencing(
        buildAttachment({ minioKey: 'pages/p1/image.png' }),
      );

      expect(dataSource.query.mock.calls[0][1]).toEqual([
        `%/media/${ATTACHMENT_ID}/raw%`,
      ]);
    });

    it('maps the trash flag', async () => {
      dataSource.query.mockResolvedValue([
        { id: 'p1', title: 'Guide', inTrash: '1' },
        { id: 'p2', title: 'FAQ', inTrash: 0 },
      ]);

      await expect(
        repository.findPagesReferencing(buildAttachment()),
      ).resolves.toEqual([
        { id: 'p1', title: 'Guide', inTrash: true },
        { id: 'p2', title: 'FAQ', inTrash: false },
      ]);
    });
  });

  describe('assignUnattachedToPage', () => {
    it('does nothing without ids', async () => {
      await repository.assignUnattachedToPage([], 'page-1', 'u1');

      expect(ormRepository.update).not.toHaveBeenCalled();
    });
  });
});
