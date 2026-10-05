import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateProfileDto } from '../dto/in/update-profile.dto.js';
import { User } from '../entities/user.entity.js';
import { TypeormUserRepository } from './typeorm.user.repository.js';

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

describe('TypeormUserRepository', () => {
  let repository: TypeormUserRepository;
  let ormRepository: {
    update: ReturnType<typeof vi.fn>;
    findOneBy: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    ormRepository = { update: vi.fn(), findOneBy: vi.fn(), count: vi.fn() };
    repository = new TypeormUserRepository(ormRepository as never);
  });

  describe('countAdmins', () => {
    it('counts every admin, deactivated ones included', async () => {
      ormRepository.count.mockResolvedValue(3);

      await expect(repository.countAdmins()).resolves.toBe(3);
      expect(ormRepository.count).toHaveBeenCalledWith({
        where: { role: 'admin' },
      });
    });
  });

  describe('update', () => {
    it('only ever persists displayName, even if a role field is smuggled in', async () => {
      const updated = buildUser({ displayName: 'New Name' });
      ormRepository.findOneBy.mockResolvedValue(updated);

      const dto = {
        displayName: 'New Name',
        role: 'admin',
      } as UpdateProfileDto;
      await repository.update('user-1', dto);

      expect(ormRepository.update).toHaveBeenCalledWith('user-1', {
        displayName: 'New Name',
      });
    });
  });

  describe('updateAvatar', () => {
    it('persists the avatar extension', async () => {
      const updated = buildUser({ avatarExtension: 'png' });
      ormRepository.findOneBy.mockResolvedValue(updated);

      await repository.updateAvatar('user-1', 'png');

      expect(ormRepository.update).toHaveBeenCalledWith('user-1', {
        avatarExtension: 'png',
      });
    });

    it('clears the avatar extension when null', async () => {
      const updated = buildUser({ avatarExtension: null });
      ormRepository.findOneBy.mockResolvedValue(updated);

      await repository.updateAvatar('user-1', null);

      expect(ormRepository.update).toHaveBeenCalledWith('user-1', {
        avatarExtension: null,
      });
    });
  });
});
