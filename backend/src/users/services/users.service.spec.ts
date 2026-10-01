import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { AdminAuditLogService } from '../../admin/services/admin-audit-log.service.js';
import { UserActivityLogService } from '../../activity/services/user-activity-log.service.js';
import { UserNotFoundException } from '../../common/exceptions/users/user-not-found.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import type { StorageService } from '../../storage/services/storage.service.js';
import { UpdateProfileDto } from '../dto/in/update-profile.dto.js';
import { User } from '../entities/user.entity.js';
import type { UserRepository } from '../persistence/user.repository.js';
import { UploadedAvatarFile, UsersService } from './users.service.js';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'hash',
    displayName: 'User One',
    avatarUrl: null,
    role: 'member',
    failedLoginAttempts: 0,
    lockedUntil: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: { [K in keyof UserRepository]: Mock<UserRepository[K]> };
  let adminAuditLogService: { record: ReturnType<typeof vi.fn> };
  let storageService: { [K in keyof StorageService]: Mock<StorageService[K]> };
  let userActivityLogService: { record: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    userRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findAllPaginated: vi.fn(),
      updateRole: vi.fn(),
      updatePassword: vi.fn(),
      delete: vi.fn(),
      incrementFailedLoginAttempts: vi.fn(),
      lockAccount: vi.fn(),
      resetFailedLoginAttempts: vi.fn(),
    };
    adminAuditLogService = { record: vi.fn().mockResolvedValue(undefined) };
    storageService = {
      upload: vi.fn().mockResolvedValue(undefined),
      download: vi.fn(),
      getPresignedUrl: vi
        .fn()
        .mockResolvedValue('https://storage.example/signed'),
      delete: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn(),
    };
    userActivityLogService = { record: vi.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: 'UsersRepository', useValue: userRepository },
        { provide: AdminAuditLogService, useValue: adminAuditLogService },
        { provide: 'StorageService', useValue: storageService },
        { provide: 'AvatarBucket', useValue: 'test-bucket' },
        { provide: UserActivityLogService, useValue: userActivityLogService },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('findById', () => {
    it('returns the user when it exists', async () => {
      const user = buildUser();
      userRepository.findById.mockResolvedValue(user);

      await expect(service.findById('user-1')).resolves.toEqual(user);
    });

    it('throws UserNotFoundException when the user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toBeInstanceOf(
        UserNotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('updates displayName and returns the updated user', async () => {
      const user = buildUser();
      const updated = buildUser({ displayName: 'New Name' });
      userRepository.findById.mockResolvedValue(user);
      userRepository.update.mockResolvedValue(updated);

      const dto: UpdateProfileDto = { displayName: 'New Name' };
      const result = await service.updateProfile('user-1', dto);

      expect(userRepository.update).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(updated);
    });

    it('throws ValidationException when displayName is empty', async () => {
      userRepository.findById.mockResolvedValue(buildUser());

      await expect(
        service.updateProfile('user-1', { displayName: '' }),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('throws ValidationException when displayName is too long', async () => {
      userRepository.findById.mockResolvedValue(buildUser());

      await expect(
        service.updateProfile('user-1', { displayName: 'a'.repeat(101) }),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(userRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('uploadAvatar', () => {
    function buildFile(
      overrides: Partial<UploadedAvatarFile> = {},
    ): UploadedAvatarFile {
      return {
        mimetype: 'image/png',
        size: 1024,
        buffer: Buffer.from('fake-image'),
        ...overrides,
      };
    }

    it('deletes any existing avatar files, uploads the new one and persists its presigned URL', async () => {
      const user = buildUser();
      const updated = buildUser({
        avatarUrl: 'https://storage.example/signed',
      });
      userRepository.findById.mockResolvedValue(user);
      userRepository.update.mockResolvedValue(updated);

      const result = await service.uploadAvatar('user-1', buildFile());

      expect(storageService.delete).toHaveBeenCalledTimes(3);
      expect(storageService.upload).toHaveBeenCalledWith(
        'test-bucket',
        'avatars/user-1/avatar.png',
        expect.any(Buffer),
        'image/png',
      );
      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        avatarUrl: 'https://storage.example/signed',
      });
      expect(result).toEqual(updated);
    });

    it('throws ValidationException when no file is provided', async () => {
      await expect(
        service.uploadAvatar('user-1', undefined),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(storageService.upload).not.toHaveBeenCalled();
    });

    it('throws ValidationException for an unsupported file type', async () => {
      userRepository.findById.mockResolvedValue(buildUser());

      await expect(
        service.uploadAvatar('user-1', buildFile({ mimetype: 'image/gif' })),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(storageService.upload).not.toHaveBeenCalled();
    });

    it('throws ValidationException when the file exceeds the size limit', async () => {
      userRepository.findById.mockResolvedValue(buildUser());

      await expect(
        service.uploadAvatar('user-1', buildFile({ size: 3 * 1024 * 1024 })),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(storageService.upload).not.toHaveBeenCalled();
    });
  });

  describe('removeAvatar', () => {
    it('deletes any existing avatar files and clears avatarUrl', async () => {
      const user = buildUser({ avatarUrl: 'https://storage.example/old' });
      const updated = buildUser({ avatarUrl: null });
      userRepository.findById.mockResolvedValue(user);
      userRepository.update.mockResolvedValue(updated);

      const result = await service.removeAvatar('user-1');

      expect(storageService.delete).toHaveBeenCalledTimes(3);
      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        avatarUrl: null,
      });
      expect(result).toEqual(updated);
    });

    it('is a no-op error-wise when there is no avatar to remove', async () => {
      userRepository.findById.mockResolvedValue(buildUser({ avatarUrl: null }));
      userRepository.update.mockResolvedValue(buildUser({ avatarUrl: null }));
      storageService.delete.mockRejectedValue(new Error('NotFound'));

      await expect(service.removeAvatar('user-1')).resolves.toBeDefined();
    });
  });
});
