import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from '../dto/in/create-user.dto.js';
import { UpdateProfileDto } from '../dto/in/update-profile.dto.js';
import { User, UserRole } from '../entities/user.entity.js';
import {
  AdminUpdateUserInput,
  UserListFilters,
  UserRepository,
} from './user.repository.js';

@Injectable()
export class TypeormUserRepository implements UserRepository {
  constructor(
    @InjectRepository(User) private readonly repository: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.repository.findOneBy({ id });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repository.findOneBy({ email });
  }

  async create(data: CreateUserDto): Promise<User> {
    const user = this.repository.create(data);
    return this.repository.save(user);
  }

  async update(id: string, data: UpdateProfileDto): Promise<User> {
    const patch: Partial<User> = {};
    if (data.displayName !== undefined) {
      patch.displayName = data.displayName;
    }

    await this.repository.update(id, patch);
    return (await this.findById(id)) as User;
  }

  async updateAvatar(
    id: string,
    avatarExtension: string | null,
  ): Promise<User> {
    await this.repository.update(id, { avatarExtension });
    return (await this.findById(id)) as User;
  }

  async adminUpdate(id: string, data: AdminUpdateUserInput): Promise<User> {
    const patch: Partial<User> = {};
    if (data.displayName !== undefined) {
      patch.displayName = data.displayName;
    }
    if (data.email !== undefined) {
      patch.email = data.email;
    }
    if (data.role !== undefined) {
      patch.role = data.role;
    }

    await this.repository.update(id, patch);
    return (await this.findById(id)) as User;
  }

  async findAllPaginated(
    page: number,
    limit: number,
  ): Promise<{ items: User[]; total: number }> {
    const [items, total] = await this.repository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'ASC' },
    });
    return { items, total };
  }

  async findAllFiltered(
    filters: UserListFilters,
    page: number,
    limit: number,
  ): Promise<{ items: User[]; total: number }> {
    const qb = this.repository.createQueryBuilder('user');

    if (filters.search) {
      qb.andWhere(
        '(user.email LIKE :search OR user.displayName LIKE :search)',
        {
          search: `%${filters.search}%`,
        },
      );
    }
    if (filters.role) {
      qb.andWhere('user.role = :role', { role: filters.role });
    }
    if (filters.active !== undefined) {
      qb.andWhere('user.isActive = :active', { active: filters.active });
    }
    if (filters.userIds) {
      qb.andWhere('user.id IN (:...userIds)', {
        userIds: filters.userIds.length > 0 ? filters.userIds : [''],
      });
    }

    qb.orderBy('user.createdAt', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async updateRole(id: string, role: UserRole): Promise<User> {
    await this.repository.update(id, { role });
    return (await this.findById(id)) as User;
  }

  async updateStatus(id: string, isActive: boolean): Promise<User> {
    await this.repository.update(id, { isActive });
    return (await this.findById(id)) as User;
  }

  async updatePassword(id: string, passwordHash: string): Promise<User> {
    await this.repository.update(id, {
      passwordHash,
      passwordChangedAt: new Date(),
    });
    return (await this.findById(id)) as User;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async incrementFailedLoginAttempts(id: string): Promise<User> {
    await this.repository.increment({ id }, 'failedLoginAttempts', 1);
    return (await this.findById(id)) as User;
  }

  async lockAccount(id: string, lockedUntil: Date): Promise<User> {
    await this.repository.update(id, { lockedUntil });
    return (await this.findById(id)) as User;
  }

  async resetFailedLoginAttempts(id: string): Promise<User> {
    await this.repository.update(id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    return (await this.findById(id)) as User;
  }

  countActiveAdmins(): Promise<number> {
    return this.repository.count({ where: { role: 'admin', isActive: true } });
  }
}
