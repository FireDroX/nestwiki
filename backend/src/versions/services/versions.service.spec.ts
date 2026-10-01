import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { VersionNotFoundException } from '../../common/exceptions/pages/version-not-found.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import { PageVersion } from '../../pages/entities/page-version.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import type { VersionsRepository } from '../persistence/version.repository.js';
import { VersionsService } from './versions.service.js';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'User One',
    passwordHash: 'hash',
    role: 'reader',
    avatarUrl: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildVersion(overrides: Partial<PageVersion> = {}): PageVersion {
  return {
    id: 'version-1',
    pageId: 'page-1',
    content: 'content',
    title: 'Title',
    authorId: 'user-1',
    changeSummary: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('VersionsService', () => {
  let service: VersionsService;
  let versionsRepository: {
    [K in keyof VersionsRepository]: Mock<VersionsRepository[K]>;
  };
  let usersService: { findById: Mock<UsersService['findById']> };

  beforeEach(async () => {
    versionsRepository = {
      create: vi.fn(),
      findAllByPageId: vi.fn(),
      findByIdAndPageId: vi.fn(),
      findContributorsByPageId: vi.fn(),
    };
    usersService = { findById: vi.fn() };

    const module = await Test.createTestingModule({
      providers: [
        VersionsService,
        { provide: 'VersionsRepository', useValue: versionsRepository },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(VersionsService);
  });

  describe('findOne', () => {
    it('returns the version when found', async () => {
      const version = buildVersion();
      versionsRepository.findByIdAndPageId.mockResolvedValue(version);

      await expect(service.findOne('page-1', 'version-1')).resolves.toBe(
        version,
      );
    });

    it('throws VersionNotFoundException when not found', async () => {
      versionsRepository.findByIdAndPageId.mockResolvedValue(null);

      await expect(service.findOne('page-1', 'missing')).rejects.toBeInstanceOf(
        VersionNotFoundException,
      );
    });
  });

  describe('computeDiff', () => {
    const fromId = '11111111-1111-1111-1111-111111111111';
    const toId = '22222222-2222-2222-2222-222222222222';

    it('computes added/removed/unchanged lines between two versions', async () => {
      versionsRepository.findByIdAndPageId.mockImplementation((id: string) => {
        if (id === fromId) {
          return Promise.resolve(
            buildVersion({ id: fromId, content: 'a\nb\n' }),
          );
        }
        if (id === toId) {
          return Promise.resolve(buildVersion({ id: toId, content: 'a\nc\n' }));
        }
        return Promise.resolve(null);
      });

      const diff = await service.computeDiff('page-1', fromId, toId);

      expect(diff.from).toBe(fromId);
      expect(diff.to).toBe(toId);
      expect(diff.changes.some((change) => change.type === 'removed')).toBe(
        true,
      );
      expect(diff.changes.some((change) => change.type === 'added')).toBe(true);
    });

    it('throws ValidationException when fromId and toId are identical', async () => {
      await expect(
        service.computeDiff('page-1', fromId, fromId),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(versionsRepository.findByIdAndPageId).not.toHaveBeenCalled();
    });

    it('throws VersionNotFoundException when a version is missing', async () => {
      versionsRepository.findByIdAndPageId.mockResolvedValue(null);

      await expect(
        service.computeDiff('page-1', fromId, toId),
      ).rejects.toBeInstanceOf(VersionNotFoundException);
    });
  });

  describe('createVersion', () => {
    it('throws ValidationException for a title that is too long', () => {
      const tooLong = 'a'.repeat(256);

      expect(() =>
        service.createVersion('page-1', 'content', tooLong, 'user-1'),
      ).toThrow(ValidationException);
      expect(versionsRepository.create).not.toHaveBeenCalled();
    });

    it('persists the new version via the repository', async () => {
      const created = buildVersion({ id: 'version-2' });
      versionsRepository.create.mockResolvedValue(created);

      const result = await service.createVersion(
        'page-1',
        'content',
        'Title',
        'user-1',
        'summary',
      );

      expect(versionsRepository.create).toHaveBeenCalledWith({
        pageId: 'page-1',
        content: 'content',
        title: 'Title',
        authorId: 'user-1',
        changeSummary: 'summary',
      });
      expect(result).toBe(created);
    });
  });

  describe('getContributors', () => {
    it('resolves each contributor to their display name and avatar, most recent first', async () => {
      versionsRepository.findContributorsByPageId.mockResolvedValue([
        { authorId: 'user-1', lastContributedAt: new Date('2026-01-02') },
        { authorId: 'user-2', lastContributedAt: new Date('2026-01-01') },
      ]);
      usersService.findById.mockImplementation((id: string) =>
        Promise.resolve(
          buildUser({
            id,
            displayName: id === 'user-1' ? 'User One' : 'User Two',
            avatarUrl:
              id === 'user-1' ? 'https://example.com/avatar.png' : null,
          }),
        ),
      );

      const contributors = await service.getContributors('page-1');

      expect(contributors).toEqual([
        {
          id: 'user-1',
          displayName: 'User One',
          avatarUrl: 'https://example.com/avatar.png',
        },
        { id: 'user-2', displayName: 'User Two', avatarUrl: null },
      ]);
    });

    it('skips contributors whose user no longer exists', async () => {
      versionsRepository.findContributorsByPageId.mockResolvedValue([
        { authorId: 'user-1', lastContributedAt: new Date() },
        { authorId: 'deleted-user', lastContributedAt: new Date() },
      ]);
      usersService.findById.mockImplementation((id: string) =>
        id === 'user-1'
          ? Promise.resolve(buildUser({ id }))
          : Promise.reject(new Error('not found')),
      );

      const contributors = await service.getContributors('page-1');

      expect(contributors).toEqual([
        { id: 'user-1', displayName: 'User One', avatarUrl: null },
      ]);
    });

    it('returns an empty array when the page has no versions', async () => {
      versionsRepository.findContributorsByPageId.mockResolvedValue([]);

      const contributors = await service.getContributors('page-1');

      expect(contributors).toEqual([]);
      expect(usersService.findById).not.toHaveBeenCalled();
    });
  });
});
