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
    avatarUrl: null,
    role: 'reader',
    failedLoginAttempts: 0,
    lockedUntil: null,
    isActive: true,
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
  };

  beforeEach(() => {
    ormRepository = { update: vi.fn(), findOneBy: vi.fn() };
    repository = new TypeormUserRepository(ormRepository as never);
  });

  describe('update', () => {
    it('only ever persists displayName and avatarUrl, even if a role field is smuggled in', async () => {
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

    it('only patches the fields actually present on the dto', async () => {
      const updated = buildUser({ avatarUrl: 'https://example.com/a.png' });
      ormRepository.findOneBy.mockResolvedValue(updated);

      await repository.update('user-1', {
        avatarUrl: 'https://example.com/a.png',
      });

      expect(ormRepository.update).toHaveBeenCalledWith('user-1', {
        avatarUrl: 'https://example.com/a.png',
      });
    });
  });
});
