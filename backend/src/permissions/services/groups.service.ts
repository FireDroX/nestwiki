import { Inject, Injectable } from '@nestjs/common';
import { AdminAuditLogService } from '../../admin/services/admin-audit-log.service.js';
import { GroupNameAlreadyExistsException } from '../../common/exceptions/permissions/group-name-already-exists.exception.js';
import { GroupNotFoundException } from '../../common/exceptions/permissions/group-not-found.exception.js';
import { GlobalPermission } from '../../common/permissions.js';
import { UsersService } from '../../users/services/users.service.js';
import { CreateGroupDto } from '../dto/in/create-group.dto.js';
import { UpdateGroupDto } from '../dto/in/update-group.dto.js';
import { Group } from '../entities/group.entity.js';
import type { GroupsRepository } from '../persistence/groups.repository.js';
import type { PageAccessRulesRepository } from '../persistence/page-access-rules.repository.js';
import type { SubjectPermissionsRepository } from '../persistence/subject-permissions.repository.js';
import type { GroupMemberDto } from '../dto/out/group-response.dto.js';
import type { AccessRuleView } from './access-rules.service.js';

export interface GroupSummary {
  group: Group;
  memberCount: number;
  ruleCount: number;
}

export interface GroupDetail {
  group: Group;
  members: GroupMemberDto[];
  permissions: GlobalPermission[];
  rules: AccessRuleView[];
}

@Injectable()
export class GroupsService {
  constructor(
    @Inject('GroupsRepository')
    private readonly groupsRepository: GroupsRepository,
    @Inject('SubjectPermissionsRepository')
    private readonly subjectPermissionsRepository: SubjectPermissionsRepository,
    @Inject('PageAccessRulesRepository')
    private readonly pageAccessRulesRepository: PageAccessRulesRepository,
    private readonly usersService: UsersService,
    private readonly adminAuditLogService: AdminAuditLogService,
  ) {}

  async list(): Promise<GroupSummary[]> {
    const groups = await this.groupsRepository.findAll();
    return Promise.all(
      groups.map(async (group) => {
        const [memberIds, rules] = await Promise.all([
          this.groupsRepository.findMemberIds(group.id),
          this.pageAccessRulesRepository.findByGroupIds([group.id]),
        ]);
        return {
          group,
          memberCount: memberIds.length,
          ruleCount: rules.length,
        };
      }),
    );
  }

  async create(dto: CreateGroupDto, actorId: string): Promise<Group> {
    const existing = await this.groupsRepository.findByName(dto.name);
    if (existing) {
      throw new GroupNameAlreadyExistsException();
    }

    const group = await this.groupsRepository.create({
      name: dto.name,
      description: dto.description ?? null,
    });

    if (dto.userIds && dto.userIds.length > 0) {
      await this.validateUserIds(dto.userIds);
      await this.groupsRepository.setMembers(group.id, dto.userIds);
    }

    await this.adminAuditLogService.record({
      adminId: actorId,
      action: 'group.create',
      targetType: 'group',
      targetId: group.id,
      metadata: { name: dto.name },
    });

    return group;
  }

  async getDetail(id: string): Promise<GroupDetail> {
    const group = await this.getByIdOrFail(id);
    const [memberIds, permissions, rules] = await Promise.all([
      this.groupsRepository.findMemberIds(id),
      this.subjectPermissionsRepository.findForGroup(id),
      this.pageAccessRulesRepository.findByGroupIds([id]),
    ]);

    const [members, exclusions] = await Promise.all([
      Promise.all(
        memberIds.map((userId) =>
          this.usersService.findById(userId).catch(() => null),
        ),
      ),
      this.pageAccessRulesRepository.findExclusionsForRules(
        rules.map((rule) => rule.id),
      ),
    ]);

    return {
      group,
      members: members
        .filter((user): user is NonNullable<typeof user> => user !== null)
        .map((user) => ({
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        })),
      permissions: permissions as GlobalPermission[],
      rules: rules.map((rule) => ({
        id: rule.id,
        pageId: rule.pageId,
        appliesTo: rule.appliesTo,
        actions: rule.actions,
        excludedPageIds: exclusions.get(rule.id) ?? [],
        grantedById: rule.grantedById,
        createdAt: rule.createdAt,
      })),
    };
  }

  async update(
    id: string,
    dto: UpdateGroupDto,
    actorId: string,
  ): Promise<Group> {
    const group = await this.getByIdOrFail(id);
    if (dto.name !== undefined && dto.name !== group.name) {
      const existing = await this.groupsRepository.findByName(dto.name);
      if (existing) {
        throw new GroupNameAlreadyExistsException();
      }
    }

    const updated = await this.groupsRepository.update(id, dto);

    await this.adminAuditLogService.record({
      adminId: actorId,
      action: 'group.update',
      targetType: 'group',
      targetId: id,
      metadata: dto,
    });

    return updated;
  }

  async delete(id: string, actorId: string): Promise<void> {
    const group = await this.getByIdOrFail(id);
    await this.groupsRepository.delete(id);

    await this.adminAuditLogService.record({
      adminId: actorId,
      action: 'group.delete',
      targetType: 'group',
      targetId: id,
      metadata: { name: group.name },
    });
  }

  async setMembers(
    id: string,
    userIds: string[],
    actorId: string,
  ): Promise<void> {
    await this.getByIdOrFail(id);
    await this.validateUserIds(userIds);
    await this.groupsRepository.setMembers(id, userIds);

    await this.adminAuditLogService.record({
      adminId: actorId,
      action: 'group.members.update',
      targetType: 'group',
      targetId: id,
      metadata: { userIds },
    });
  }

  async getByIdOrFail(id: string): Promise<Group> {
    const group = await this.groupsRepository.findById(id);
    if (!group) {
      throw new GroupNotFoundException();
    }
    return group;
  }

  private async validateUserIds(userIds: string[]): Promise<void> {
    await Promise.all(
      userIds.map((userId) => this.usersService.findById(userId)),
    );
  }
}
