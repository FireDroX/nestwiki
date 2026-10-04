import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { AdminAuditLogService } from '../../admin/services/admin-audit-log.service.js';
import { UserActivityLogService } from '../../activity/services/user-activity-log.service.js';
import { AvatarNotFoundException } from '../../common/exceptions/users/avatar-not-found.exception.js';
import { EmailAlreadyExistsException } from '../../common/exceptions/auth/email-already-exists.exception.js';
import { InsufficientPermissionException } from '../../common/exceptions/insufficient-permission.exception.js';
import { LastActiveAdminException } from '../../common/exceptions/users/last-active-admin.exception.js';
import { SelfActionNotAllowedException } from '../../common/exceptions/users/self-action-not-allowed.exception.js';
import { UserNotFoundException } from '../../common/exceptions/users/user-not-found.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import type { AuthenticatedUser } from '../../common/strategies/jwt.strategy.js';
import type { GroupsRepository } from '../../permissions/persistence/groups.repository.js';
import type { PageAccessRulesRepository } from '../../permissions/persistence/page-access-rules.repository.js';
import type { SubjectPermissionsRepository } from '../../permissions/persistence/subject-permissions.repository.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import type { StorageService } from '../../storage/services/storage.service.js';
import { CreateAdminUserDto } from '../dto/in/create-admin-user.dto.js';
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
    avatarExtension: null,
    role: 'member',
    failedLoginAttempts: 0,
    lockedUntil: null,
    isActive: true,
    passwordChangedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildActor(
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  return {
    id: 'admin-1',
    email: 'admin@example.com',
    role: 'admin',
    ...overrides,
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: { [K in keyof UserRepository]: Mock<UserRepository[K]> };
  let adminAuditLogService: { record: ReturnType<typeof vi.fn> };
  let storageService: { [K in keyof StorageService]: Mock<StorageService[K]> };
  let userActivityLogService: {
    record: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  let groupsRepository: {
    [K in keyof GroupsRepository]: Mock<GroupsRepository[K]>;
  };
  let subjectPermissionsRepository: {
    [K in keyof SubjectPermissionsRepository]: Mock<
      SubjectPermissionsRepository[K]
    >;
  };
  let pageAccessRulesRepository: {
    [K in keyof PageAccessRulesRepository]: Mock<PageAccessRulesRepository[K]>;
  };
  let permissionsService: {
    hasGlobal: Mock<PermissionsService['hasGlobal']>;
    hasUnrestrictedPageAccess: Mock<
      PermissionsService['hasUnrestrictedPageAccess']
    >;
    hasUnrestrictedActionOnSubtree: Mock<
      PermissionsService['hasUnrestrictedActionOnSubtree']
    >;
    getEffectivePageActions: Mock<
      PermissionsService['getEffectivePageActions']
    >;
  };

  beforeEach(async () => {
    userRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      updateAvatar: vi.fn(),
      adminUpdate: vi.fn(),
      findAllPaginated: vi.fn(),
      findAllFiltered: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      updateRole: vi.fn(),
      updateStatus: vi.fn(),
      updatePassword: vi.fn(),
      delete: vi.fn(),
      incrementFailedLoginAttempts: vi.fn(),
      lockAccount: vi.fn(),
      resetFailedLoginAttempts: vi.fn(),
      countActiveAdmins: vi.fn().mockResolvedValue(2),
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
    userActivityLogService = {
      record: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    groupsRepository = {
      findAll: vi.fn().mockResolvedValue([]),
      findById: vi.fn(),
      findByIds: vi.fn().mockResolvedValue([]),
      findByName: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMemberIds: vi.fn().mockResolvedValue([]),
      findGroupIdsForUser: vi.fn().mockResolvedValue([]),
      setMembers: vi.fn(),
      setGroupsForUser: vi.fn(),
    };
    subjectPermissionsRepository = {
      findForUser: vi.fn().mockResolvedValue([]),
      findForGroup: vi.fn().mockResolvedValue([]),
      findForGroups: vi.fn().mockResolvedValue([]),
      setForUser: vi.fn(),
      setForGroup: vi.fn(),
    };
    pageAccessRulesRepository = {
      findByUserId: vi.fn().mockResolvedValue([]),
      findByGroupIds: vi.fn().mockResolvedValue([]),
      findByPageIdsOrWholeWiki: vi.fn().mockResolvedValue([]),
      findById: vi.fn(),
      create: vi.fn(),
      updateActions: vi.fn(),
      delete: vi.fn(),
      findExclusions: vi.fn(),
      setExclusions: vi.fn(),
      findExclusionsForRules: vi.fn().mockResolvedValue(new Map()),
    };
    permissionsService = {
      hasGlobal: vi.fn().mockResolvedValue(true),
      hasUnrestrictedPageAccess: vi.fn().mockResolvedValue(true),
      hasUnrestrictedActionOnSubtree: vi.fn().mockResolvedValue(true),
      getEffectivePageActions: vi.fn().mockResolvedValue([]),
    };

    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: 'UsersRepository', useValue: userRepository },
        { provide: AdminAuditLogService, useValue: adminAuditLogService },
        { provide: 'StorageService', useValue: storageService },
        { provide: 'AvatarBucket', useValue: 'test-bucket' },
        { provide: UserActivityLogService, useValue: userActivityLogService },
        { provide: 'GroupsRepository', useValue: groupsRepository },
        {
          provide: 'SubjectPermissionsRepository',
          useValue: subjectPermissionsRepository,
        },
        {
          provide: 'PageAccessRulesRepository',
          useValue: pageAccessRulesRepository,
        },
        { provide: PermissionsService, useValue: permissionsService },
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

    it('deletes any existing avatar files, uploads the new one and persists its extension', async () => {
      const user = buildUser();
      const updated = buildUser({ avatarExtension: 'png' });
      userRepository.findById.mockResolvedValue(user);
      userRepository.updateAvatar.mockResolvedValue(updated);

      const result = await service.uploadAvatar('user-1', buildFile());

      expect(storageService.delete).toHaveBeenCalledTimes(4);
      expect(storageService.upload).toHaveBeenCalledWith(
        'test-bucket',
        'avatars/user-1/avatar.png',
        expect.any(Buffer),
        'image/png',
      );
      expect(userRepository.updateAvatar).toHaveBeenCalledWith('user-1', 'png');
      expect(result).toEqual(updated);
    });

    it('throws ValidationException when no file is provided', async () => {
      await expect(
        service.uploadAvatar('user-1', undefined),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(storageService.upload).not.toHaveBeenCalled();
    });

    it('accepts an animated GIF and keeps its content type', async () => {
      userRepository.findById.mockResolvedValue(buildUser());
      userRepository.updateAvatar.mockResolvedValue(
        buildUser({ avatarExtension: 'gif' }),
      );

      await service.uploadAvatar(
        'user-1',
        buildFile({ mimetype: 'image/gif' }),
      );

      expect(storageService.upload).toHaveBeenCalledWith(
        'test-bucket',
        'avatars/user-1/avatar.gif',
        expect.any(Buffer),
        'image/gif',
      );
      expect(userRepository.updateAvatar).toHaveBeenCalledWith('user-1', 'gif');
    });

    it('throws ValidationException for an unsupported file type', async () => {
      userRepository.findById.mockResolvedValue(buildUser());

      await expect(
        service.uploadAvatar('user-1', buildFile({ mimetype: 'image/bmp' })),
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
    it('deletes any existing avatar files and clears the avatar extension', async () => {
      const user = buildUser({ avatarExtension: 'png' });
      const updated = buildUser({ avatarExtension: null });
      userRepository.findById.mockResolvedValue(user);
      userRepository.updateAvatar.mockResolvedValue(updated);

      const result = await service.removeAvatar('user-1');

      expect(storageService.delete).toHaveBeenCalledTimes(4);
      expect(userRepository.updateAvatar).toHaveBeenCalledWith('user-1', null);
      expect(result).toEqual(updated);
    });

    it('is a no-op error-wise when there is no avatar to remove', async () => {
      userRepository.findById.mockResolvedValue(
        buildUser({ avatarExtension: null }),
      );
      userRepository.updateAvatar.mockResolvedValue(
        buildUser({ avatarExtension: null }),
      );
      storageService.delete.mockRejectedValue(new Error('NotFound'));

      await expect(service.removeAvatar('user-1')).resolves.toBeDefined();
    });
  });

  describe('getAvatarRedirectUrl', () => {
    it('returns a fresh presigned URL for the stored avatar extension', async () => {
      userRepository.findById.mockResolvedValue(
        buildUser({ avatarExtension: 'png' }),
      );

      const url = await service.getAvatarRedirectUrl('user-1');

      expect(storageService.getPresignedUrl).toHaveBeenCalledWith(
        'test-bucket',
        'avatars/user-1/avatar.png',
        expect.any(Number),
      );
      expect(url).toBe('https://storage.example/signed');
    });

    it('throws AvatarNotFoundException when the user has no avatar', async () => {
      userRepository.findById.mockResolvedValue(
        buildUser({ avatarExtension: null }),
      );

      await expect(
        service.getAvatarRedirectUrl('user-1'),
      ).rejects.toBeInstanceOf(AvatarNotFoundException);
    });
  });

  describe('createByAdmin', () => {
    const dto: CreateAdminUserDto = {
      email: 'new@example.com',
      displayName: 'New User',
    };

    it('creates a member with a generated temporary password when none is provided', async () => {
      userRepository.create.mockResolvedValue(buildUser({ email: dto.email }));

      const result = await service.createByAdmin(buildActor(), dto);

      expect(result.temporaryPassword).toMatch(/A1!$/);
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: dto.email, role: 'member' }),
      );
      expect(adminAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.create' }),
      );
    });

    it('does not generate a temporary password when one is provided', async () => {
      userRepository.create.mockResolvedValue(buildUser({ email: dto.email }));

      const result = await service.createByAdmin(buildActor(), {
        ...dto,
        password: 'ProvidedPass1!',
      });

      expect(result.temporaryPassword).toBeNull();
    });

    it('rejects a duplicate email with EmailAlreadyExistsException', async () => {
      userRepository.findByEmail.mockResolvedValue(buildUser());

      await expect(
        service.createByAdmin(buildActor(), dto),
      ).rejects.toBeInstanceOf(EmailAlreadyExistsException);
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('blocks a non-admin actor from creating an admin user', async () => {
      const actor = buildActor({ role: 'member' });

      await expect(
        service.createByAdmin(actor, { ...dto, role: 'admin' }),
      ).rejects.toBeInstanceOf(InsufficientPermissionException);
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('assigns initial groups after validating they all exist', async () => {
      userRepository.findById.mockResolvedValue(
        buildUser({ id: 'admin-1', role: 'admin' }),
      );
      userRepository.create.mockResolvedValue(buildUser({ email: dto.email }));
      groupsRepository.findByIds.mockResolvedValue([
        {
          id: 'group-1',
          name: 'Group',
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      await service.createByAdmin(buildActor(), {
        ...dto,
        groupIds: ['group-1'],
      });

      expect(groupsRepository.setGroupsForUser).toHaveBeenCalledWith(
        expect.any(String),
        ['group-1'],
      );
    });

    it('blocks a non-admin user.manage holder from assigning a group that grants a permission they lack', async () => {
      userRepository.findById.mockResolvedValue(
        buildUser({ id: 'actor-1', role: 'member' }),
      );
      groupsRepository.findByIds.mockResolvedValue([
        {
          id: 'group-1',
          name: 'Group',
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      subjectPermissionsRepository.findForGroup.mockResolvedValue([
        'user.manage',
      ]);
      permissionsService.hasGlobal.mockResolvedValue(false);

      await expect(
        service.createByAdmin(buildActor({ id: 'actor-1', role: 'member' }), {
          ...dto,
          groupIds: ['group-1'],
        }),
      ).rejects.toBeInstanceOf(InsufficientPermissionException);
      expect(userRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('adminUpdate', () => {
    it('updates displayName/email/role and records a single audit entry', async () => {
      userRepository.findById.mockResolvedValue(buildUser());
      userRepository.adminUpdate.mockResolvedValue(
        buildUser({ displayName: 'Updated' }),
      );

      const result = await service.adminUpdate(buildActor(), 'user-1', {
        displayName: 'Updated',
      });

      expect(result.displayName).toBe('Updated');
      expect(adminAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.update' }),
      );
    });

    it('rejects a duplicate email owned by another user', async () => {
      userRepository.findById.mockResolvedValue(buildUser());
      userRepository.findByEmail.mockResolvedValue(
        buildUser({ id: 'user-2', email: 'taken@example.com' }),
      );

      await expect(
        service.adminUpdate(buildActor(), 'user-1', {
          email: 'taken@example.com',
        }),
      ).rejects.toBeInstanceOf(EmailAlreadyExistsException);
    });

    it('blocks an admin from demoting themselves', async () => {
      const actor = buildActor({ id: 'user-1' });
      userRepository.findById.mockResolvedValue(
        buildUser({ id: 'user-1', role: 'admin' }),
      );

      await expect(
        service.adminUpdate(actor, 'user-1', { role: 'member' }),
      ).rejects.toBeInstanceOf(SelfActionNotAllowedException);
    });

    it('blocks demoting the last active admin', async () => {
      userRepository.findById.mockResolvedValue(
        buildUser({ id: 'user-2', role: 'admin' }),
      );
      userRepository.countActiveAdmins.mockResolvedValue(1);

      await expect(
        service.adminUpdate(buildActor(), 'user-2', { role: 'member' }),
      ).rejects.toBeInstanceOf(LastActiveAdminException);
    });

    it('blocks a non-admin actor from promoting anyone to admin', async () => {
      userRepository.findById.mockResolvedValue(buildUser({ id: 'user-2' }));

      await expect(
        service.adminUpdate(buildActor({ role: 'member' }), 'user-2', {
          role: 'admin',
        }),
      ).rejects.toBeInstanceOf(InsufficientPermissionException);
    });

    it('blocks a non-admin user.manage holder from demoting another admin', async () => {
      userRepository.findById.mockResolvedValue(
        buildUser({ id: 'user-2', role: 'admin' }),
      );

      await expect(
        service.adminUpdate(
          buildActor({ id: 'actor-1', role: 'member' }),
          'user-2',
          {
            role: 'member',
          },
        ),
      ).rejects.toBeInstanceOf(InsufficientPermissionException);
      expect(userRepository.adminUpdate).not.toHaveBeenCalled();
    });

    it('blocks a non-admin user.manage holder from editing another admin (no role change)', async () => {
      userRepository.findById.mockResolvedValue(
        buildUser({ id: 'user-2', role: 'admin' }),
      );

      await expect(
        service.adminUpdate(
          buildActor({ id: 'actor-1', role: 'member' }),
          'user-2',
          { email: 'attacker@example.com' },
        ),
      ).rejects.toBeInstanceOf(InsufficientPermissionException);
      expect(userRepository.adminUpdate).not.toHaveBeenCalled();
    });
  });

  describe('setStatus', () => {
    it('deactivates a user and records an audit entry', async () => {
      userRepository.findById.mockResolvedValue(buildUser({ id: 'user-2' }));
      userRepository.updateStatus.mockResolvedValue(
        buildUser({ id: 'user-2', isActive: false }),
      );

      const result = await service.setStatus(buildActor(), 'user-2', false);

      expect(result.isActive).toBe(false);
      expect(adminAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.status.update' }),
      );
    });

    it('blocks an admin from deactivating themselves', async () => {
      const actor = buildActor({ id: 'user-1' });
      userRepository.findById.mockResolvedValue(
        buildUser({ id: 'user-1', role: 'admin' }),
      );

      await expect(
        service.setStatus(actor, 'user-1', false),
      ).rejects.toBeInstanceOf(SelfActionNotAllowedException);
    });

    it('blocks deactivating the last active admin', async () => {
      userRepository.findById.mockResolvedValue(
        buildUser({ id: 'user-2', role: 'admin' }),
      );
      userRepository.countActiveAdmins.mockResolvedValue(1);

      await expect(
        service.setStatus(buildActor(), 'user-2', false),
      ).rejects.toBeInstanceOf(LastActiveAdminException);
    });

    it('blocks a non-admin user.manage holder from deactivating another admin', async () => {
      userRepository.findById.mockResolvedValue(
        buildUser({ id: 'user-2', role: 'admin' }),
      );

      await expect(
        service.setStatus(
          buildActor({ id: 'actor-1', role: 'member' }),
          'user-2',
          false,
        ),
      ).rejects.toBeInstanceOf(InsufficientPermissionException);
      expect(userRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('blocks a non-admin user.manage holder from re-enabling a disabled admin', async () => {
      userRepository.findById.mockResolvedValue(
        buildUser({ id: 'user-2', role: 'admin', isActive: false }),
      );

      await expect(
        service.setStatus(
          buildActor({ id: 'actor-1', role: 'member' }),
          'user-2',
          true,
        ),
      ).rejects.toBeInstanceOf(InsufficientPermissionException);
      expect(userRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('rejects a non-boolean isActive value', async () => {
      await expect(
        service.setStatus(
          buildActor(),
          'user-2',
          undefined as unknown as boolean,
        ),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(userRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('deleteUser', () => {
    it('deletes the user and records an audit entry', async () => {
      userRepository.findById.mockResolvedValue(buildUser({ id: 'user-2' }));

      await service.deleteUser(buildActor(), 'user-2');

      expect(userRepository.delete).toHaveBeenCalledWith('user-2');
      expect(adminAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.delete' }),
      );
    });

    it('blocks an admin from deleting themselves', async () => {
      const actor = buildActor({ id: 'user-1' });

      await expect(service.deleteUser(actor, 'user-1')).rejects.toBeInstanceOf(
        SelfActionNotAllowedException,
      );
      expect(userRepository.delete).not.toHaveBeenCalled();
    });

    it('blocks deleting the last active admin', async () => {
      userRepository.findById.mockResolvedValue(
        buildUser({ id: 'user-2', role: 'admin' }),
      );
      userRepository.countActiveAdmins.mockResolvedValue(1);

      await expect(
        service.deleteUser(buildActor(), 'user-2'),
      ).rejects.toBeInstanceOf(LastActiveAdminException);
      expect(userRepository.delete).not.toHaveBeenCalled();
    });

    it('blocks a non-admin user.manage holder from deleting another admin', async () => {
      userRepository.findById.mockResolvedValue(
        buildUser({ id: 'user-2', role: 'admin' }),
      );

      await expect(
        service.deleteUser(
          buildActor({ id: 'actor-1', role: 'member' }),
          'user-2',
        ),
      ).rejects.toBeInstanceOf(InsufficientPermissionException);
      expect(userRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('generates and persists a temporary password, and records an audit entry', async () => {
      userRepository.findById.mockResolvedValue(buildUser());

      const temporaryPassword = await service.resetPassword(
        buildActor(),
        'user-1',
      );

      expect(temporaryPassword).toMatch(/A1!$/);
      expect(userRepository.updatePassword).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),
      );
      expect(adminAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.password.reset' }),
      );
    });

    it("blocks a non-admin user.manage holder from resetting another admin's password", async () => {
      userRepository.findById.mockResolvedValue(
        buildUser({ id: 'user-2', role: 'admin' }),
      );

      await expect(
        service.resetPassword(
          buildActor({ id: 'actor-1', role: 'member' }),
          'user-2',
        ),
      ).rejects.toBeInstanceOf(InsufficientPermissionException);
      expect(userRepository.updatePassword).not.toHaveBeenCalled();
    });
  });

  describe('unlock', () => {
    it('resets failed login attempts and records an audit entry', async () => {
      userRepository.findById.mockResolvedValue(buildUser());
      userRepository.resetFailedLoginAttempts.mockResolvedValue(
        buildUser({ failedLoginAttempts: 0, lockedUntil: null }),
      );

      await service.unlock(buildActor(), 'user-1');

      expect(userRepository.resetFailedLoginAttempts).toHaveBeenCalledWith(
        'user-1',
      );
      expect(adminAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.unlock' }),
      );
    });

    it('blocks a non-admin user.manage holder from unlocking another admin', async () => {
      userRepository.findById.mockResolvedValue(
        buildUser({ id: 'user-2', role: 'admin' }),
      );

      await expect(
        service.unlock(buildActor({ id: 'actor-1', role: 'member' }), 'user-2'),
      ).rejects.toBeInstanceOf(InsufficientPermissionException);
      expect(userRepository.resetFailedLoginAttempts).not.toHaveBeenCalled();
    });
  });

  describe('setGroups', () => {
    it('replaces group membership after validating every group exists', async () => {
      userRepository.findById.mockResolvedValue(buildUser());
      groupsRepository.findByIds.mockResolvedValue([
        {
          id: 'group-1',
          name: 'Group',
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      await service.setGroups(buildActor(), 'user-1', ['group-1']);

      expect(groupsRepository.setGroupsForUser).toHaveBeenCalledWith('user-1', [
        'group-1',
      ]);
      expect(adminAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.groups.update' }),
      );
    });

    it('throws GroupNotFoundException when a group id does not exist', async () => {
      userRepository.findById.mockResolvedValue(buildUser());
      groupsRepository.findByIds.mockResolvedValue([]);

      await expect(
        service.setGroups(buildActor(), 'user-1', ['missing-group']),
      ).rejects.toThrow();
      expect(groupsRepository.setGroupsForUser).not.toHaveBeenCalled();
    });

    it('blocks a non-admin user.manage holder from adding a group that grants a permission they lack', async () => {
      userRepository.findById.mockResolvedValue(buildUser());
      groupsRepository.findByIds.mockResolvedValue([
        {
          id: 'group-1',
          name: 'Group',
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      subjectPermissionsRepository.findForGroup.mockResolvedValue([
        'user.manage',
      ]);
      permissionsService.hasGlobal.mockResolvedValue(false);

      await expect(
        service.setGroups(
          buildActor({ id: 'actor-1', role: 'member' }),
          'user-1',
          ['group-1'],
        ),
      ).rejects.toBeInstanceOf(InsufficientPermissionException);
      expect(groupsRepository.setGroupsForUser).not.toHaveBeenCalled();
    });

    it('adds a group when the actor already holds everything it grants', async () => {
      userRepository.findById.mockResolvedValue(buildUser());
      groupsRepository.findByIds.mockResolvedValue([
        {
          id: 'group-1',
          name: 'Group',
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      subjectPermissionsRepository.findForGroup.mockResolvedValue([
        'tag.create',
      ]);
      permissionsService.hasGlobal.mockResolvedValue(true);

      await service.setGroups(buildActor(), 'user-1', ['group-1']);

      expect(groupsRepository.setGroupsForUser).toHaveBeenCalledWith('user-1', [
        'group-1',
      ]);
    });

    it('skips the escalation check for a group the target already belongs to', async () => {
      userRepository.findById.mockResolvedValue(buildUser());
      groupsRepository.findGroupIdsForUser.mockResolvedValue(['group-1']);
      groupsRepository.findByIds.mockResolvedValue([
        {
          id: 'group-1',
          name: 'Group',
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      subjectPermissionsRepository.findForGroup.mockResolvedValue([
        'user.manage',
      ]);
      permissionsService.hasGlobal.mockResolvedValue(false);

      await service.setGroups(
        buildActor({ id: 'actor-1', role: 'member' }),
        'user-1',
        ['group-1'],
      );

      expect(groupsRepository.setGroupsForUser).toHaveBeenCalledWith('user-1', [
        'group-1',
      ]);
    });

    it('rejects a non-array groupIds value', async () => {
      await expect(
        service.setGroups(
          buildActor(),
          'user-1',
          undefined as unknown as string[],
        ),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(groupsRepository.setGroupsForUser).not.toHaveBeenCalled();
    });
  });
});
