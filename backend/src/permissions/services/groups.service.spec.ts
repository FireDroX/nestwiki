import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { AdminAuditLogService } from '../../admin/services/admin-audit-log.service.js';
import { GroupNameAlreadyExistsException } from '../../common/exceptions/permissions/group-name-already-exists.exception.js';
import { GroupNotFoundException } from '../../common/exceptions/permissions/group-not-found.exception.js';
import { UserNotFoundException } from '../../common/exceptions/users/user-not-found.exception.js';
import { User } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import { Group } from '../entities/group.entity.js';
import { PageAccessRule } from '../entities/page-access-rule.entity.js';
import type {
  CreateGroupInput,
  GroupsRepository,
  UpdateGroupInput,
} from '../persistence/groups.repository.js';
import type { PageAccessRulesRepository } from '../persistence/page-access-rules.repository.js';
import type { SubjectPermissionsRepository } from '../persistence/subject-permissions.repository.js';
import { GroupsService } from './groups.service.js';

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

function buildGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'group-1',
    name: 'Éditeurs',
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildRule(overrides: Partial<PageAccessRule> = {}): PageAccessRule {
  return {
    id: 'rule-1',
    userId: null,
    groupId: 'group-1',
    pageId: null,
    appliesTo: 'subtree',
    actions: ['page.read'],
    grantedById: 'admin-1',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('GroupsService', () => {
  let service: GroupsService;
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
  let usersService: { findById: Mock<UsersService['findById']> };
  let adminAuditLogService: { record: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    groupsRepository = {
      findAll: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(buildGroup()),
      findByIds: vi.fn().mockResolvedValue([]),
      findByName: vi.fn().mockResolvedValue(null),
      create: vi
        .fn()
        .mockImplementation((input: CreateGroupInput) =>
          Promise.resolve(buildGroup(input)),
        ),
      update: vi
        .fn()
        .mockImplementation((id: string, input: UpdateGroupInput) =>
          Promise.resolve(buildGroup({ id, ...input })),
        ),
      delete: vi.fn(),
      findMemberIds: vi.fn().mockResolvedValue([]),
      findGroupIdsForUser: vi.fn(),
      setMembers: vi.fn(),
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
    usersService = {
      findById: vi
        .fn()
        .mockImplementation((id: string) => Promise.resolve(buildUser({ id }))),
    };
    adminAuditLogService = { record: vi.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        GroupsService,
        { provide: 'GroupsRepository', useValue: groupsRepository },
        {
          provide: 'SubjectPermissionsRepository',
          useValue: subjectPermissionsRepository,
        },
        {
          provide: 'PageAccessRulesRepository',
          useValue: pageAccessRulesRepository,
        },
        { provide: UsersService, useValue: usersService },
        { provide: AdminAuditLogService, useValue: adminAuditLogService },
      ],
    }).compile();

    service = module.get(GroupsService);
  });

  describe('create', () => {
    it('creates a group and records an audit entry', async () => {
      const group = await service.create({ name: 'Éditeurs' }, 'admin-1');

      expect(group.name).toBe('Éditeurs');
      expect(adminAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'group.create' }),
      );
    });

    it('rejects a duplicate name with 409', async () => {
      groupsRepository.findByName.mockResolvedValue(buildGroup());

      await expect(
        service.create({ name: 'Éditeurs' }, 'admin-1'),
      ).rejects.toBeInstanceOf(GroupNameAlreadyExistsException);
    });

    it('sets initial members when userIds is provided, after validating they exist', async () => {
      await service.create(
        { name: 'Éditeurs', userIds: ['user-1', 'user-2'] },
        'admin-1',
      );

      expect(usersService.findById).toHaveBeenCalledWith('user-1');
      expect(usersService.findById).toHaveBeenCalledWith('user-2');
      expect(groupsRepository.setMembers).toHaveBeenCalledWith(
        expect.any(String),
        ['user-1', 'user-2'],
      );
    });

    it('propagates UserNotFoundException when an initial member does not exist', async () => {
      usersService.findById.mockRejectedValueOnce(new UserNotFoundException());

      await expect(
        service.create({ name: 'Éditeurs', userIds: ['missing'] }, 'admin-1'),
      ).rejects.toBeInstanceOf(UserNotFoundException);
      expect(groupsRepository.setMembers).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws GroupNotFoundException for a missing group', async () => {
      groupsRepository.findById.mockResolvedValue(null);

      await expect(
        service.update('missing', { name: 'X' }, 'admin-1'),
      ).rejects.toBeInstanceOf(GroupNotFoundException);
    });

    it('rejects renaming to a name already used by another group', async () => {
      groupsRepository.findById.mockResolvedValue(
        buildGroup({ id: 'group-1', name: 'Éditeurs' }),
      );
      groupsRepository.findByName.mockResolvedValue(
        buildGroup({ id: 'group-2', name: 'Lecteurs' }),
      );

      await expect(
        service.update('group-1', { name: 'Lecteurs' }, 'admin-1'),
      ).rejects.toBeInstanceOf(GroupNameAlreadyExistsException);
    });

    it('allows keeping the same name without a duplicate check', async () => {
      groupsRepository.findById.mockResolvedValue(
        buildGroup({ id: 'group-1', name: 'Éditeurs' }),
      );

      await service.update('group-1', { name: 'Éditeurs' }, 'admin-1');

      expect(groupsRepository.findByName).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes the group and records an audit entry', async () => {
      await service.delete('group-1', 'admin-1');

      expect(groupsRepository.delete).toHaveBeenCalledWith('group-1');
      expect(adminAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'group.delete',
          targetId: 'group-1',
        }),
      );
    });

    it('throws GroupNotFoundException for a missing group', async () => {
      groupsRepository.findById.mockResolvedValue(null);

      await expect(service.delete('missing', 'admin-1')).rejects.toBeInstanceOf(
        GroupNotFoundException,
      );
    });
  });

  describe('list', () => {
    it('aggregates member and rule counts per group', async () => {
      groupsRepository.findAll.mockResolvedValue([
        buildGroup({ id: 'group-1' }),
        buildGroup({ id: 'group-2', name: 'Lecteurs' }),
      ]);
      groupsRepository.findMemberIds.mockImplementation((id: string) =>
        Promise.resolve(id === 'group-1' ? ['u1', 'u2'] : []),
      );
      pageAccessRulesRepository.findByGroupIds.mockImplementation(
        (ids: string[]) =>
          Promise.resolve(ids[0] === 'group-1' ? [buildRule()] : []),
      );

      const summaries = await service.list();

      const byId = new Map(summaries.map((s) => [s.group.id, s]));
      expect(byId.get('group-1')).toMatchObject({
        memberCount: 2,
        ruleCount: 1,
      });
      expect(byId.get('group-2')).toMatchObject({
        memberCount: 0,
        ruleCount: 0,
      });
    });
  });

  describe('getDetail', () => {
    it('throws GroupNotFoundException for a missing group', async () => {
      groupsRepository.findById.mockResolvedValue(null);

      await expect(service.getDetail('missing')).rejects.toBeInstanceOf(
        GroupNotFoundException,
      );
    });

    it('resolves members, permissions, and rules with their exclusions', async () => {
      groupsRepository.findMemberIds.mockResolvedValue(['user-1']);
      subjectPermissionsRepository.findForGroup.mockResolvedValue([
        'tag.create',
      ]);
      pageAccessRulesRepository.findByGroupIds.mockResolvedValue([
        buildRule({ id: 'rule-1' }),
      ]);
      pageAccessRulesRepository.findExclusionsForRules.mockResolvedValue(
        new Map([['rule-1', ['excluded-page']]]),
      );

      const detail = await service.getDetail('group-1');

      expect(detail.members).toEqual([
        { id: 'user-1', email: 'user@example.com', displayName: 'User One' },
      ]);
      expect(detail.permissions).toEqual(['tag.create']);
      expect(detail.rules[0].excludedPageIds).toEqual(['excluded-page']);
    });
  });

  describe('setMembers', () => {
    it('validates every user id exists before replacing membership', async () => {
      await service.setMembers('group-1', ['user-1', 'user-2'], 'admin-1');

      expect(groupsRepository.setMembers).toHaveBeenCalledWith('group-1', [
        'user-1',
        'user-2',
      ]);
      expect(adminAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'group.members.update' }),
      );
    });

    it('throws GroupNotFoundException for a missing group', async () => {
      groupsRepository.findById.mockResolvedValue(null);

      await expect(
        service.setMembers('missing', [], 'admin-1'),
      ).rejects.toBeInstanceOf(GroupNotFoundException);
    });
  });
});
