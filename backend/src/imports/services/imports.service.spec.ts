import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { ZipArchive } from 'archiver';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { UserActivityLogService } from '../../activity/services/user-activity-log.service.js';
import { InsufficientPagePermissionException } from '../../common/exceptions/pages/insufficient-page-permission.exception.js';
import { PageNotFoundException } from '../../common/exceptions/pages/page-not-found.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import type { AuthenticatedUser } from '../../common/strategies/jwt.strategy.js';
import { MediaService } from '../../media/services/media.service.js';
import type { Page } from '../../pages/entities/page.entity.js';
import { PAGE_TREE_CHANGED_EVENT } from '../../pages/events/page-tree-changed.event.js';
import {
  PAGES_IMPORTED_EVENT,
  PagesImportedEvent,
} from '../../pages/events/pages-imported.event.js';
import { PagesService } from '../../pages/services/pages.service.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import { TagsService } from '../../tags/services/tags.service.js';
import type { User } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import { ImportMapper } from '../mapper/import.mapper.js';
import type { ImportWriteInput } from '../persistence/import.repository.js';
import { ImportsService } from './imports.service.js';

const currentUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'u@x.com',
  role: 'member',
};
const user = { id: 'user-1', role: 'member' } as User;
const DOCS_ID = '11111111-1111-4111-8111-111111111111';
const GUIDE_ID = '22222222-2222-4222-8222-222222222222';
const INSTALL_ID = '33333333-3333-4333-8333-333333333333';

function page(id: string, slug: string, parentId: string | null): Page {
  return { id, slug, parentId, title: slug } as Page;
}

async function zipFile(entries: Record<string, string | Buffer>) {
  const archive = new ZipArchive();
  const chunks: Buffer[] = [];
  archive.on('data', (chunk: Buffer) => chunks.push(chunk));
  const ended = new Promise((resolve) => archive.on('end', resolve));
  for (const [name, data] of Object.entries(entries)) {
    archive.append(data, { name });
  }
  await archive.finalize();
  await ended;
  const buffer = Buffer.concat(chunks);
  return { originalname: 'import.zip', size: buffer.length, buffer };
}

function markdownFile(name: string, content: string) {
  const buffer = Buffer.from(content);
  return { originalname: name, size: buffer.length, buffer };
}

describe('ImportsService', () => {
  let service: ImportsService;
  let can: Mock;
  let hasGlobal: Mock;
  let getByIdOrFail: Mock;
  let write: Mock;
  let storeImportedFile: Mock;
  let discardImportedFiles: Mock;
  let indexImportedPages: Mock;
  let emit: Mock;
  let record: Mock;

  beforeEach(async () => {
    can = vi.fn().mockResolvedValue(true);
    hasGlobal = vi.fn().mockResolvedValue(true);
    getByIdOrFail = vi.fn().mockResolvedValue(page(DOCS_ID, 'docs', null));
    write = vi.fn().mockResolvedValue(undefined);
    let uploads = 0;
    storeImportedFile = vi.fn(() => Promise.resolve(`key-${++uploads}`));
    discardImportedFiles = vi.fn().mockResolvedValue(undefined);
    indexImportedPages = vi.fn().mockResolvedValue(undefined);
    emit = vi.fn();
    record = vi.fn().mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        ImportsService,
        {
          provide: PagesService,
          useValue: {
            getByIdOrFail,
            listAllPages: vi
              .fn()
              .mockResolvedValue([
                page(DOCS_ID, 'docs', null),
                page(GUIDE_ID, 'guide', DOCS_ID),
                page(INSTALL_ID, 'install', GUIDE_ID),
              ]),
            indexImportedPages,
          },
        },
        { provide: PermissionsService, useValue: { can, hasGlobal } },
        {
          provide: UsersService,
          useValue: { findById: vi.fn().mockResolvedValue(user) },
        },
        {
          provide: TagsService,
          useValue: {
            listTags: vi
              .fn()
              .mockResolvedValue([{ id: 'tag-projet', name: 'Projet' }]),
          },
        },
        {
          provide: MediaService,
          useValue: { storeImportedFile, discardImportedFiles },
        },
        { provide: UserActivityLogService, useValue: { record } },
        { provide: EventEmitter2, useValue: { emit } },
        { provide: 'ImportsRepository', useValue: { write } },
      ],
    }).compile();

    service = module.get(ImportsService);
  });

  it('requires page.create_child on the destination page', async () => {
    can.mockResolvedValue(false);

    await expect(
      service.preview(
        markdownFile('guide.md', '# Guide'),
        { parentId: DOCS_ID },
        currentUser,
      ),
    ).rejects.toThrow(InsufficientPagePermissionException);
    expect(can).toHaveBeenCalledWith(user, 'page.create_child', DOCS_ID);
  });

  it('requires page.create_root to import at the root', async () => {
    hasGlobal.mockResolvedValue(false);

    await expect(
      service.preview(markdownFile('guide.md', '# Guide'), {}, currentUser),
    ).rejects.toThrow(InsufficientPagePermissionException);
    expect(hasGlobal).toHaveBeenCalledWith(user, 'page.create_root');
  });

  it('fails when the destination page cannot be read', async () => {
    getByIdOrFail.mockRejectedValue(new PageNotFoundException());

    await expect(
      service.preview(
        markdownFile('guide.md', '# Guide'),
        { parentId: DOCS_ID },
        currentUser,
      ),
    ).rejects.toThrow(PageNotFoundException);
  });

  it('checks the rights before reading the file', async () => {
    can.mockResolvedValue(false);

    await expect(
      service.preview(undefined, { parentId: DOCS_ID }, currentUser),
    ).rejects.toThrow(InsufficientPagePermissionException);
  });

  it('rejects an invalid parentId or conflict mode', async () => {
    await expect(
      service.preview(
        markdownFile('a.md', '# A'),
        { parentId: 'nope' },
        currentUser,
      ),
    ).rejects.toThrow(ValidationException);
    await expect(
      service.preview(
        markdownFile('a.md', '# A'),
        { conflict: 'merge' },
        currentUser,
      ),
    ).rejects.toThrow(ValidationException);
  });

  it('computes the plan under the destination with conflicts, tags and permissions', async () => {
    hasGlobal.mockImplementation((_user: User, permission: string) =>
      Promise.resolve(permission !== 'tag.create'),
    );

    const plan = ImportMapper.toPlanDto(
      await service.preview(
        markdownFile(
          'guide.md',
          '---\ntags: [projet, nouveau]\n---\n# Guide\n\n[[Absente]]',
        ),
        { parentId: DOCS_ID },
        currentUser,
      ),
    );

    expect(plan).toMatchObject({
      format: 'obsidian',
      destination: { id: DOCS_ID, path: '/docs' },
      conflictMode: 'skip',
      pageCount: 1,
      conflictCount: 1,
      pages: [
        {
          path: '/docs/guide',
          title: 'Guide',
          action: 'skip',
          conflict: { path: '/docs/guide' },
          children: [],
        },
      ],
      tags: { existing: ['projet'], missing: ['nouveau'] },
      permissions: { canCreateTags: false, canUploadMedia: true },
      warnings: {
        unresolvedLinks: [{ page: '/docs/guide', target: 'Absente' }],
        missingTags: ['nouveau'],
        mediaWithoutUpload: 0,
      },
    });
  });

  it('applies the requested conflict mode to the paths', async () => {
    const plan = ImportMapper.toPlanDto(
      await service.preview(
        markdownFile('guide.md', '# Guide'),
        { parentId: DOCS_ID, conflict: 'rename' },
        currentUser,
      ),
    );

    expect(plan.pages[0]).toMatchObject({
      path: '/docs/guide-2',
      action: 'create',
      conflict: null,
    });
    expect(plan.warnings.renamedSlugs).toEqual([
      {
        page: '/docs/guide-2',
        from: 'guide',
        to: 'guide-2',
        reason: 'conflict',
      },
    ]);
  });

  describe('execute', () => {
    const writtenInput = (): ImportWriteInput =>
      write.mock.calls[0][0] as ImportWriteInput;

    it('creates pages from parent to child with one version each', async () => {
      await service.execute(
        await zipFile({
          'Projet/Projet.md': '# Projet\n\n[[Tâche]]',
          'Projet/Tâche.md': '# Tâche',
          'Projet/Sous/Note.md': '# Note',
        }),
        {},
        currentUser,
      );

      const { createdPages, updatedPages, authorId, changeSummary } =
        writtenInput();
      expect(authorId).toBe('user-1');
      expect(changeSummary).toBe('Import');
      expect(updatedPages).toEqual([]);
      expect(createdPages.map((created) => created.slug)).toEqual([
        'projet',
        'sous',
        'note',
        'tache',
      ]);
      const [projet, sous, note, tache] = createdPages;
      expect(projet).toMatchObject({ parentId: null, visibility: 'private' });
      expect(sous.parentId).toBe(projet.id);
      expect(note.parentId).toBe(sous.id);
      expect(tache.parentId).toBe(projet.id);
      expect(projet.content).toBe('# Projet\n\n[Tâche](/pages/projet/tache)');
      expect(indexImportedPages).toHaveBeenCalledWith(
        createdPages.map((created) => ({
          pageId: created.id,
          versionId: created.versionId,
          content: created.content,
        })),
      );
    });

    it('skips an existing page by default and imports its children under it', async () => {
      const result = await service.execute(
        await zipFile({
          'guide.md': '# Guide importé',
          'guide/install.md': '# Install',
          'guide/nouveau.md': '# Nouveau',
        }),
        { parentId: DOCS_ID },
        currentUser,
      );

      expect(writtenInput().createdPages).toMatchObject([
        { slug: 'nouveau', parentId: GUIDE_ID },
      ]);
      expect(ImportMapper.toReportResponse(result).data).toMatchObject({
        rootPath: '/docs/guide',
        created: [{ path: '/docs/guide/nouveau' }],
        updated: [],
        skipped: [
          { id: GUIDE_ID, path: '/docs/guide', reason: 'exists' },
          { id: INSTALL_ID, path: '/docs/guide/install', reason: 'exists' },
        ],
      });
    });

    it('renames conflicting pages and rewrites links to the renamed paths', async () => {
      await service.execute(
        await zipFile({
          'guide.md': '# Guide\n\n[install](guide/install.md)',
          'guide/install.md': '# Install\n\n[[guide#Début]]',
        }),
        { parentId: DOCS_ID, conflict: 'rename' },
        currentUser,
      );

      const [guide, install] = writtenInput().createdPages;
      expect(guide).toMatchObject({ slug: 'guide-2', parentId: DOCS_ID });
      expect(install).toMatchObject({ slug: 'install', parentId: guide.id });
      expect(guide.content).toBe(
        '# Guide\n\n[install](/pages/docs/guide-2/install)',
      );
      expect(install.content).toBe(
        '# Install\n\n[guide > Début](/pages/docs/guide-2#début)',
      );
    });

    it('adds a new version to existing pages in update mode', async () => {
      await service.execute(
        await zipFile({
          'guide.md': '# Guide v2',
          'guide/install.md': '# Install v2',
        }),
        { parentId: DOCS_ID, conflict: 'update' },
        currentUser,
      );

      const { createdPages, updatedPages } = writtenInput();
      expect(createdPages).toEqual([]);
      expect(updatedPages).toEqual([
        expect.objectContaining({
          pageId: GUIDE_ID,
          title: 'Guide v2',
          content: '# Guide v2',
        }),
        expect.objectContaining({
          pageId: INSTALL_ID,
          content: '# Install v2',
        }),
      ]);
      expect(can).toHaveBeenCalledWith(user, 'page.edit', GUIDE_ID);
    });

    it('skips pages the user cannot edit in update mode', async () => {
      can.mockImplementation((_user: User, action: string, pageId: string) =>
        Promise.resolve(!(action === 'page.edit' && pageId === GUIDE_ID)),
      );

      const result = await service.execute(
        await zipFile({
          'guide.md': '# Guide v2',
          'guide/install.md': '# Install v2',
        }),
        { parentId: DOCS_ID, conflict: 'update' },
        currentUser,
      );

      expect(writtenInput().updatedPages.map((page) => page.pageId)).toEqual([
        INSTALL_ID,
      ]);
      expect(ImportMapper.toReportResponse(result).data?.skipped).toEqual([
        {
          id: GUIDE_ID,
          path: '/docs/guide',
          title: 'Guide v2',
          reason: 'forbidden',
        },
      ]);
    });

    it('does not create children under an existing page without page.create_child on it', async () => {
      can.mockImplementation((_user: User, action: string, pageId: string) =>
        Promise.resolve(
          !(action === 'page.create_child' && pageId === GUIDE_ID),
        ),
      );

      const result = await service.execute(
        await zipFile({
          'guide.md': '# Guide',
          'guide/nouveau.md': '# Nouveau',
          'guide/nouveau/enfant.md': '# Enfant',
        }),
        { parentId: DOCS_ID },
        currentUser,
      );

      expect(writtenInput().createdPages).toEqual([]);
      expect(
        ImportMapper.toReportResponse(result).data?.skipped.map((skipped) => [
          skipped.path,
          skipped.reason,
        ]),
      ).toEqual([
        ['/docs/guide', 'exists'],
        ['/docs/guide/nouveau', 'forbidden'],
        ['/docs/guide/nouveau/enfant', 'forbidden'],
      ]);
    });

    it('uploads media and rewrites their links to /api/media/<id>/raw', async () => {
      const result = await service.execute(
        await zipFile({
          'note.md': '# Note\n\n![[photo.png]]',
          'images/photo.png': Buffer.from([1, 2, 3]),
        }),
        {},
        currentUser,
      );

      const { createdPages, attachments } = writtenInput();
      expect(storeImportedFile).toHaveBeenCalledWith({
        pageId: createdPages[0].id,
        filename: 'photo.png',
        mimeType: 'image/png',
        data: Buffer.from([1, 2, 3]),
      });
      expect(attachments).toEqual([
        expect.objectContaining({
          pageId: createdPages[0].id,
          minioKey: 'key-1',
          filename: 'photo.png',
          size: 3,
        }),
      ]);
      expect(createdPages[0].content).toBe(
        `# Note\n\n![photo.png](/api/media/${attachments[0].id}/raw)`,
      );
      expect(result.uploadedMediaCount).toBe(1);
    });

    it('imports no media without media.upload and reports it', async () => {
      hasGlobal.mockImplementation((_user: User, permission: string) =>
        Promise.resolve(permission !== 'media.upload'),
      );

      const result = await service.execute(
        await zipFile({
          'note.md': '# Note\n\n![[photo.png]]',
          'photo.png': Buffer.from([1]),
        }),
        {},
        currentUser,
      );

      expect(storeImportedFile).not.toHaveBeenCalled();
      expect(writtenInput().attachments).toEqual([]);
      expect(writtenInput().createdPages[0].content).toBe(
        '# Note\n\n![photo.png](photo.png)',
      );
      expect(
        ImportMapper.toReportResponse(result).data?.warnings.mediaWithoutUpload,
      ).toBe(1);
    });

    it('applies existing tags and creates missing ones when asked and allowed', async () => {
      const result = await service.execute(
        markdownFile('note.md', '---\ntags: [projet, nouveau]\n---\n# Note'),
        { createMissingTags: 'true' },
        currentUser,
      );

      const { createdPages, tags, pageTags } = writtenInput();
      expect(tags).toEqual([
        expect.objectContaining({ name: 'nouveau', color: '#6b7280' }),
      ]);
      expect(pageTags).toEqual([
        { pageId: createdPages[0].id, tagId: 'tag-projet' },
        { pageId: createdPages[0].id, tagId: tags[0].id },
      ]);
      expect(result.createdTags).toEqual(['nouveau']);
      expect(result.skippedTags).toEqual([]);
    });

    it('skips missing tags without tag.create, or when not asked', async () => {
      hasGlobal.mockImplementation((_user: User, permission: string) =>
        Promise.resolve(permission !== 'tag.create'),
      );
      const withoutRight = await service.execute(
        markdownFile('note.md', '---\ntags: [projet, nouveau]\n---\n# Note'),
        { createMissingTags: 'true' },
        currentUser,
      );
      hasGlobal.mockResolvedValue(true);
      const notAsked = await service.execute(
        markdownFile('note.md', '---\ntags: [nouveau]\n---\n# Note'),
        {},
        currentUser,
      );

      expect(writtenInput().tags).toEqual([]);
      expect(writtenInput().pageTags).toHaveLength(1);
      expect(withoutRight.skippedTags).toEqual(['nouveau']);
      expect(
        ImportMapper.toReportResponse(withoutRight).data?.warnings.missingTags,
      ).toEqual(['nouveau']);
      expect(notAsked.skippedTags).toEqual(['nouveau']);
    });

    it('creates public pages when asked', async () => {
      await service.execute(
        markdownFile('note.md', '# Note'),
        { visibility: 'public' },
        currentUser,
      );

      expect(writtenInput().createdPages[0].visibility).toBe('public');
    });

    it('rejects invalid options', async () => {
      await expect(
        service.execute(
          markdownFile('note.md', '# Note'),
          { visibility: 'secret' },
          currentUser,
        ),
      ).rejects.toThrow(ValidationException);
      await expect(
        service.execute(
          markdownFile('note.md', '# Note'),
          { createMissingTags: 'yes' },
          currentUser,
        ),
      ).rejects.toThrow(ValidationException);
    });

    it('rolls back: deletes uploaded objects and announces nothing when writing fails', async () => {
      write.mockRejectedValue(new Error('deadlock'));

      await expect(
        service.execute(
          await zipFile({
            'a.md': '# A\n\n![[one.png]]',
            'b.md': '# B\n\n![[two.png]]',
            'one.png': Buffer.from([1]),
            'two.png': Buffer.from([2]),
          }),
          {},
          currentUser,
        ),
      ).rejects.toThrow('deadlock');

      expect(discardImportedFiles).toHaveBeenCalledWith(['key-1', 'key-2']);
      expect(indexImportedPages).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
    });

    it('deletes the objects already uploaded when an upload fails midway', async () => {
      storeImportedFile
        .mockResolvedValueOnce('key-1')
        .mockRejectedValueOnce(new Error('storage down'));

      await expect(
        service.execute(
          await zipFile({
            'a.md': '# A\n\n![[one.png]] ![[two.png]]',
            'one.png': Buffer.from([1]),
            'two.png': Buffer.from([2]),
          }),
          {},
          currentUser,
        ),
      ).rejects.toThrow('storage down');

      expect(write).not.toHaveBeenCalled();
      expect(discardImportedFiles).toHaveBeenCalledWith(['key-1']);
    });

    it('emits a single tree change and a single pages.imported event, and records the activity', async () => {
      await service.execute(
        await zipFile({
          'guide.md': '# Guide',
          'guide/install.md': '# Install',
          'guide/nouveau.md': '# Nouveau',
          'guide/autre.md': '# Autre',
        }),
        { parentId: DOCS_ID, conflict: 'update' },
        currentUser,
      );

      expect(emit).toHaveBeenCalledTimes(2);
      expect(emit).toHaveBeenCalledWith(PAGE_TREE_CHANGED_EVENT);
      expect(emit).toHaveBeenCalledWith(
        PAGES_IMPORTED_EVENT,
        new PagesImportedEvent('user-1', 2, 2, GUIDE_ID),
      );
      expect(record).toHaveBeenCalledWith({
        userId: 'user-1',
        action: 'page.imported',
        targetType: 'page',
        targetId: GUIDE_ID,
        metadata: {
          destination: '/docs',
          created: 2,
          updated: 2,
          skipped: 0,
          media: 0,
          tagsCreated: 0,
        },
      });
    });

    it('emits nothing when every page is skipped', async () => {
      await service.execute(
        markdownFile('guide.md', '# Guide'),
        { parentId: DOCS_ID },
        currentUser,
      );

      expect(emit).not.toHaveBeenCalled();
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'page.imported',
          metadata: expect.objectContaining({
            created: 0,
            skipped: 1,
          }) as unknown,
        }),
      );
    });
  });
});
