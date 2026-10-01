import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GroupPermission } from '../entities/group-permission.entity.js';
import { UserPermission } from '../entities/user-permission.entity.js';
import { SubjectPermissionsRepository } from './subject-permissions.repository.js';

@Injectable()
export class TypeormSubjectPermissionsRepository implements SubjectPermissionsRepository {
  constructor(
    @InjectRepository(UserPermission)
    private readonly userPermissions: Repository<UserPermission>,
    @InjectRepository(GroupPermission)
    private readonly groupPermissions: Repository<GroupPermission>,
  ) {}

  async findForUser(userId: string): Promise<string[]> {
    const rows = await this.userPermissions.findBy({ userId });
    return rows.map((row) => row.permission);
  }

  async findForGroup(groupId: string): Promise<string[]> {
    const rows = await this.groupPermissions.findBy({ groupId });
    return rows.map((row) => row.permission);
  }

  async findForGroups(groupIds: string[]): Promise<string[]> {
    if (groupIds.length === 0) {
      return [];
    }
    const rows = await this.groupPermissions.findBy({
      groupId: In(groupIds),
    });
    return rows.map((row) => row.permission);
  }

  async setForUser(userId: string, permissions: string[]): Promise<void> {
    await this.userPermissions.delete({ userId });
    if (permissions.length === 0) {
      return;
    }
    await this.userPermissions.save(
      permissions.map((permission) =>
        this.userPermissions.create({ userId, permission }),
      ),
    );
  }

  async setForGroup(groupId: string, permissions: string[]): Promise<void> {
    await this.groupPermissions.delete({ groupId });
    if (permissions.length === 0) {
      return;
    }
    await this.groupPermissions.save(
      permissions.map((permission) =>
        this.groupPermissions.create({ groupId, permission }),
      ),
    );
  }
}
