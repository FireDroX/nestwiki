import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { AdminAuditLogService } from '../../admin/services/admin-audit-log.service.js';
import { AccessRuleNotFoundException } from '../../common/exceptions/permissions/access-rule-not-found.exception.js';
import { GroupNotFoundException } from '../../common/exceptions/permissions/group-not-found.exception.js';
import { InsufficientPermissionException } from '../../common/exceptions/insufficient-permission.exception.js';
import { PageNotFoundException } from '../../common/exceptions/pages/page-not-found.exception.js';
import { UserNotFoundException } from '../../common/exceptions/users/user-not-found.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import { User } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import { Group } from '../entities/group.entity.js';
import { PageAccessRule } from '../entities/page-access-rule.entity.js';
import type { GroupsRepository } from '../persistence/groups.repository.js';
import type {
  CreatePageAccessRuleInput,
  PageAccessRulesRepository,
} from '../persistence/page-access-rules.repository.js';
import type { PageHierarchyRepository } from '../persistence/page-hierarchy.repository.js';
import type { SubjectPermissionsRepository } from '../persistence/subject-permissions.repository.js';
import { AccessRulesService } from './access-rules.service.js';
import { PermissionsService } from './permissions.service.js';

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
    userId: 'user-1',
    groupId: null,
    pageId: 'page-1',
    appliesTo: 'page',
    actions: ['page.read', 'page.edit'],
    grantedById: 'admin-1',
    createdAt: new Date(),
    ...overrides,
  };
}

function chainFor(pageId: string, chainIds: string[]) {
  return new Map([
    [pageId, { pageId, visibility: 'private' as const, chainIds }],
  ]);
}

describe('AccessRulesService', () => {
  let service: AccessRulesService;
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
  let pageHierarchyRepository: {
    [K in keyof PageHierarchyRepository]: Mock<PageHierarchyRepository[K]>;
  };
  let usersService: { findById: Mock<UsersService['findById']> };
  let permissionsService: {
    getEffectivePageActions: Mock<
      PermissionsService['getEffectivePageActions']
    >;
    hasUnrestrictedPageAccess: Mock<
      PermissionsService['hasUnrestrictedPageAccess']
    >;
    hasUnrestrictedActionOnSubtree: Mock<
      PermissionsService['hasUnrestrictedActionOnSubtree']
    >;
    hasGlobal: Mock<PermissionsService['hasGlobal']>;
  };
  let adminAuditLogService: { record: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    groupsRepository = {
      findAll: vi.fn(),
      findById: vi.fn().mockResolvedValue(buildGroup()),
      findByIds: vi.fn().mockResolvedValue([]),
      findByName: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMemberIds: vi.fn(),
      findGroupIdsForUser: vi.fn(),
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
      create: vi.fn().mockImplementation((input: CreatePageAccessRuleInput) =>
        Promise.resolve({
          id: 'rule-new',
          createdAt: new Date(),
          ...input,
        }),
      ),
      updateActions: vi.fn(),
      delete: vi.fn(),
      findExclusions: vi.fn().mockResolvedValue([]),
      setExclusions: vi.fn(),
      findExclusionsForRules: vi.fn().mockResolvedValue(new Map()),
    };
    pageHierarchyRepository = {
      findChains: vi.fn().mockResolvedValue(new Map()),
      findDescendantIds: vi.fn().mockResolvedValue(new Map()),
      findAllPageIds: vi.fn().mockResolvedValue([]),
    };
    usersService = {
      findById: vi
        .fn()
        .mockImplementation((id: string) => Promise.resolve(buildUser({ id }))),
    };
    permissionsService = {
      getEffectivePageActions: vi.fn().mockResolvedValue([]),
      hasUnrestrictedPageAccess: vi.fn().mockResolvedValue(false),
      hasUnrestrictedActionOnSubtree: vi.fn().mockResolvedValue(true),
      hasGlobal: vi.fn().mockResolvedValue(true),
    };
    adminAuditLogService = { record: vi.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        AccessRulesService,
        { provide: 'GroupsRepository', useValue: groupsRepository },
        {
          provide: 'SubjectPermissionsRepository',
          useValue: subjectPermissionsRepository,
        },
        {
          provide: 'PageAccessRulesRepository',
          useValue: pageAccessRulesRepository,
        },
        {
          provide: 'PageHierarchyRepository',
          useValue: pageHierarchyRepository,
        },
        { provide: UsersService, useValue: usersService },
        { provide: PermissionsService, useValue: permissionsService },
        { provide: AdminAuditLogService, useValue: adminAuditLogService },
      ],
    }).compile();

    service = module.get(AccessRulesService);
  });

  describe('createAccessRule', () => {
    it('creates a page.read rule for a single user on a private page', async () => {
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('page-1', ['page-1']),
      );
      permissionsService.getEffectivePageActions.mockResolvedValue([
        'page.read',
      ]);

      const rule = await service.createAccessRule(
        { type: 'user', id: 'user-1' },
        { pageId: 'page-1', appliesTo: 'page', actions: ['page.read'] },
        'admin-1',
      );

      expect(rule.actions).toEqual(['page.read']);
      expect(pageAccessRulesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', groupId: null }),
      );
      expect(adminAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'access_rule.create' }),
      );
    });

    it('creates the same rule for a group instead of a user', async () => {
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('page-1', ['page-1']),
      );
      permissionsService.getEffectivePageActions.mockResolvedValue([
        'page.read',
      ]);

      await service.createAccessRule(
        { type: 'group', id: 'group-1' },
        { pageId: 'page-1', appliesTo: 'page', actions: ['page.read'] },
        'admin-1',
      );

      expect(pageAccessRulesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: null, groupId: 'group-1' }),
      );
    });

    it('automatically adds page.read when a write action is granted', async () => {
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('page-1', ['page-1']),
      );
      permissionsService.getEffectivePageActions.mockResolvedValue([
        'page.read',
        'page.edit',
      ]);

      const rule = await service.createAccessRule(
        { type: 'user', id: 'user-1' },
        { pageId: 'page-1', appliesTo: 'page', actions: ['page.edit'] },
        'admin-1',
      );

      expect(new Set(rule.actions)).toEqual(
        new Set(['page.edit', 'page.read']),
      );
    });

    it('throws when the subject user does not exist', async () => {
      usersService.findById.mockRejectedValueOnce(new UserNotFoundException());

      await expect(
        service.createAccessRule(
          { type: 'user', id: 'missing' },
          { pageId: null, appliesTo: 'subtree', actions: ['page.read'] },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(UserNotFoundException);
    });

    it('throws when the subject group does not exist', async () => {
      groupsRepository.findById.mockResolvedValue(null);

      await expect(
        service.createAccessRule(
          { type: 'group', id: 'missing' },
          { pageId: null, appliesTo: 'subtree', actions: ['page.read'] },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(GroupNotFoundException);
    });

    it('throws when pageId does not resolve to an existing page', async () => {
      pageHierarchyRepository.findChains.mockResolvedValue(new Map());

      await expect(
        service.createAccessRule(
          { type: 'user', id: 'user-1' },
          { pageId: 'missing', appliesTo: 'page', actions: ['page.read'] },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(PageNotFoundException);
    });

    it('rejects empty actions', async () => {
      await expect(
        service.createAccessRule(
          { type: 'user', id: 'user-1' },
          { pageId: null, appliesTo: 'subtree', actions: [] },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('rejects excludedPageIds when appliesTo is "page"', async () => {
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('page-1', ['page-1']),
      );

      await expect(
        service.createAccessRule(
          { type: 'user', id: 'user-1' },
          {
            pageId: 'page-1',
            appliesTo: 'page',
            actions: ['page.read'],
            excludedPageIds: ['child-1'],
          },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('rejects an exclusion outside the subtree rooted at pageId', async () => {
      pageHierarchyRepository.findChains.mockImplementation((ids: string[]) => {
        if (ids.includes('sibling')) {
          return Promise.resolve(
            new Map([
              [
                'sibling',
                {
                  pageId: 'sibling',
                  visibility: 'private' as const,
                  chainIds: ['sibling', 'root'],
                },
              ],
            ]),
          );
        }
        return Promise.resolve(chainFor('parent', ['parent', 'root']));
      });
      permissionsService.getEffectivePageActions.mockResolvedValue([
        'page.read',
      ]);

      await expect(
        service.createAccessRule(
          { type: 'user', id: 'user-1' },
          {
            pageId: 'parent',
            appliesTo: 'subtree',
            actions: ['page.read'],
            excludedPageIds: ['sibling'],
          },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('accepts a valid exclusion that is a strict descendant of pageId', async () => {
      pageHierarchyRepository.findChains.mockImplementation((ids: string[]) => {
        if (ids.includes('child')) {
          return Promise.resolve(
            new Map([
              [
                'child',
                {
                  pageId: 'child',
                  visibility: 'private' as const,
                  chainIds: ['child', 'parent'],
                },
              ],
            ]),
          );
        }
        return Promise.resolve(chainFor('parent', ['parent']));
      });
      permissionsService.getEffectivePageActions.mockResolvedValue([
        'page.read',
      ]);

      const rule = await service.createAccessRule(
        { type: 'user', id: 'user-1' },
        {
          pageId: 'parent',
          appliesTo: 'subtree',
          actions: ['page.read'],
          excludedPageIds: ['child'],
        },
        'admin-1',
      );

      expect(rule.excludedPageIds).toEqual(['child']);
      expect(pageAccessRulesRepository.setExclusions).toHaveBeenCalledWith(
        'rule-new',
        ['child'],
      );
    });

    it('blocks escalation: actor cannot grant a page action they do not themselves hold', async () => {
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('page-1', ['page-1']),
      );
      permissionsService.getEffectivePageActions.mockResolvedValue([
        'page.read',
        'page.edit',
      ]);

      await expect(
        service.createAccessRule(
          { type: 'user', id: 'user-1' },
          { pageId: 'page-1', appliesTo: 'page', actions: ['page.delete'] },
          'actor-1',
        ),
      ).rejects.toBeInstanceOf(InsufficientPermissionException);
    });

    it('blocks escalation on a whole-wiki rule using hasUnrestrictedPageAccess', async () => {
      permissionsService.hasUnrestrictedPageAccess.mockResolvedValue(false);

      await expect(
        service.createAccessRule(
          { type: 'user', id: 'user-1' },
          { pageId: null, appliesTo: 'subtree', actions: ['page.delete'] },
          'actor-1',
        ),
      ).rejects.toBeInstanceOf(InsufficientPermissionException);
      expect(permissionsService.hasUnrestrictedPageAccess).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'actor-1' }),
        'page.delete',
      );
    });

    it('blocks a subtree grant when the actor is themselves excluded somewhere inside that subtree', async () => {
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('parent', ['parent']),
      );
      permissionsService.hasUnrestrictedActionOnSubtree.mockResolvedValue(
        false,
      );

      await expect(
        service.createAccessRule(
          { type: 'user', id: 'user-1' },
          { pageId: 'parent', appliesTo: 'subtree', actions: ['page.edit'] },
          'actor-1',
        ),
      ).rejects.toBeInstanceOf(InsufficientPermissionException);
      expect(
        permissionsService.hasUnrestrictedActionOnSubtree,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'actor-1' }),
        'parent',
        'page.edit',
      );
    });
  });

  describe('listAccessRulesForPage', () => {
    it('marks a rule directly on the page as not inherited, and an ancestor subtree rule as inherited', async () => {
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('child', ['child', 'parent']),
      );
      pageAccessRulesRepository.findByPageIdsOrWholeWiki.mockResolvedValue([
        buildRule({ id: 'direct', pageId: 'child', appliesTo: 'page' }),
        buildRule({
          id: 'inherited',
          pageId: 'parent',
          appliesTo: 'subtree',
          userId: null,
          groupId: 'group-1',
        }),
        buildRule({
          id: 'unrelated-page',
          pageId: 'other-page',
          appliesTo: 'page',
        }),
      ]);

      const result = await service.listAccessRulesForPage('child');

      const byId = new Map(result.map((r) => [r.id, r]));
      expect(byId.get('direct')?.inherited).toBe(false);
      expect(byId.get('inherited')?.inherited).toBe(true);
      expect(byId.has('unrelated-page')).toBe(false);
    });

    it('includes a whole-wiki subtree rule as inherited', async () => {
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('page-1', ['page-1']),
      );
      pageAccessRulesRepository.findByPageIdsOrWholeWiki.mockResolvedValue([
        buildRule({ id: 'whole-wiki', pageId: null, appliesTo: 'subtree' }),
      ]);

      const result = await service.listAccessRulesForPage('page-1');

      expect(result).toHaveLength(1);
      expect(result[0].inherited).toBe(true);
    });

    it('throws PageNotFoundException for a nonexistent page', async () => {
      pageHierarchyRepository.findChains.mockResolvedValue(new Map());

      await expect(
        service.listAccessRulesForPage('missing'),
      ).rejects.toBeInstanceOf(PageNotFoundException);
    });
  });

  describe('ownership checks', () => {
    it('rejects updating a rule that belongs to a different subject', async () => {
      pageAccessRulesRepository.findById.mockResolvedValue(
        buildRule({ userId: 'user-1', groupId: null }),
      );

      await expect(
        service.updateAccessRule(
          { type: 'group', id: 'group-1' },
          'rule-1',
          { actions: ['page.read'] },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(AccessRuleNotFoundException);
    });

    it('rejects deleting a rule that belongs to a different subject', async () => {
      pageAccessRulesRepository.findById.mockResolvedValue(
        buildRule({ userId: 'user-1', groupId: null }),
      );

      await expect(
        service.deleteAccessRule(
          { type: 'group', id: 'group-1' },
          'rule-1',
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(AccessRuleNotFoundException);
    });

    it('rejects updating an inherited rule through the page-scoped endpoint', async () => {
      pageAccessRulesRepository.findById.mockResolvedValue(
        buildRule({ id: 'rule-1', pageId: 'parent' }),
      );

      await expect(
        service.updateAccessRuleForPage(
          'child',
          'rule-1',
          { actions: ['page.read'] },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(AccessRuleNotFoundException);
    });

    it('allows updating a rule directly on the page through the page-scoped endpoint', async () => {
      pageAccessRulesRepository.findById.mockResolvedValue(
        buildRule({ id: 'rule-1', pageId: 'page-1', userId: 'user-1' }),
      );
      permissionsService.getEffectivePageActions.mockResolvedValue([
        'page.read',
      ]);

      const rule = await service.updateAccessRuleForPage(
        'page-1',
        'rule-1',
        { actions: ['page.read'] },
        'admin-1',
      );

      expect(rule.id).toBe('rule-1');
      expect(pageAccessRulesRepository.updateActions).toHaveBeenCalledWith(
        'rule-1',
        ['page.read'],
      );
    });
  });

  describe('applyUpdate escalation checks', () => {
    it('re-checks escalation when only excludedPageIds change, even though actions are untouched', async () => {
      pageAccessRulesRepository.findById.mockResolvedValue(
        buildRule({
          id: 'rule-1',
          pageId: 'parent',
          appliesTo: 'subtree',
          actions: ['page.read', 'page.edit'],
        }),
      );
      pageHierarchyRepository.findChains.mockImplementation((ids: string[]) => {
        if (ids.includes('child')) {
          return Promise.resolve(
            new Map([
              [
                'child',
                {
                  pageId: 'child',
                  visibility: 'private' as const,
                  chainIds: ['child', 'parent'],
                },
              ],
            ]),
          );
        }
        return Promise.resolve(chainFor('parent', ['parent']));
      });
      permissionsService.hasUnrestrictedActionOnSubtree.mockResolvedValue(
        false,
      );

      await expect(
        service.updateAccessRule(
          { type: 'user', id: 'user-1' },
          'rule-1',
          { excludedPageIds: [] },
          'actor-1',
        ),
      ).rejects.toBeInstanceOf(InsufficientPermissionException);
      expect(pageAccessRulesRepository.setExclusions).not.toHaveBeenCalled();
    });

    it('applies the exclusion change once escalation passes', async () => {
      pageAccessRulesRepository.findById.mockResolvedValue(
        buildRule({
          id: 'rule-1',
          pageId: 'parent',
          appliesTo: 'subtree',
          actions: ['page.read', 'page.edit'],
        }),
      );
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('parent', ['parent']),
      );
      permissionsService.hasUnrestrictedActionOnSubtree.mockResolvedValue(true);

      const rule = await service.updateAccessRule(
        { type: 'user', id: 'user-1' },
        'rule-1',
        { excludedPageIds: [] },
        'actor-1',
      );

      expect(rule.excludedPageIds).toEqual([]);
      expect(pageAccessRulesRepository.setExclusions).toHaveBeenCalledWith(
        'rule-1',
        [],
      );
    });
  });

  describe('setGlobalPermissions', () => {
    it('rejects an invalid permission code', async () => {
      await expect(
        service.setGlobalPermissions(
          { type: 'user', id: 'user-1' },
          ['not.a.real.permission' as never],
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('dedupes and forwards to setForGroup for a group subject', async () => {
      await service.setGlobalPermissions(
        { type: 'group', id: 'group-1' },
        ['tag.create', 'tag.create'],
        'admin-1',
      );

      expect(subjectPermissionsRepository.setForGroup).toHaveBeenCalledWith(
        'group-1',
        ['tag.create'],
      );
      expect(adminAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'group.permissions.update' }),
      );
    });

    it('blocks an actor from granting a global permission they do not themselves hold', async () => {
      permissionsService.hasGlobal.mockResolvedValue(false);

      await expect(
        service.setGlobalPermissions(
          { type: 'user', id: 'user-1' },
          ['user.manage'],
          'actor-1',
        ),
      ).rejects.toBeInstanceOf(InsufficientPermissionException);
      expect(subjectPermissionsRepository.setForUser).not.toHaveBeenCalled();
    });
  });
});
