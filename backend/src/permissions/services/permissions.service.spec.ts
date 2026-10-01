import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { Page } from '../../pages/entities/page.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { PageAccessRule } from '../entities/page-access-rule.entity.js';
import type { GroupsRepository } from '../persistence/groups.repository.js';
import type { PageAccessRulesRepository } from '../persistence/page-access-rules.repository.js';
import type { PageHierarchyRepository } from '../persistence/page-hierarchy.repository.js';
import type { SubjectPermissionsRepository } from '../persistence/subject-permissions.repository.js';
import { PermissionsService } from './permissions.service.js';

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

function buildRule(overrides: Partial<PageAccessRule> = {}): PageAccessRule {
  return {
    id: 'rule-1',
    userId: null,
    groupId: null,
    pageId: null,
    appliesTo: 'subtree',
    actions: ['page.read'],
    grantedById: 'admin-1',
    createdAt: new Date(),
    ...overrides,
  };
}

function buildPage(overrides: Partial<Page> = {}): Page {
  return {
    id: 'page-1',
    slug: 'home',
    title: 'Home',
    parentId: null,
    currentVersionId: 'version-1',
    visibility: 'public',
    commentsEnabled: true,
    viewCount: 0,
    createdById: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('PermissionsService', () => {
  let service: PermissionsService;
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

  beforeEach(async () => {
    groupsRepository = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByIds: vi.fn().mockResolvedValue([]),
      findByName: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findMemberIds: vi.fn(),
      findGroupIdsForUser: vi.fn().mockResolvedValue([]),
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
      findById: vi.fn(),
      create: vi.fn(),
      updateActions: vi.fn(),
      delete: vi.fn(),
      findExclusions: vi.fn(),
      setExclusions: vi.fn(),
      findExclusionsForRules: vi.fn().mockResolvedValue(new Map()),
    };
    pageHierarchyRepository = {
      findChains: vi.fn().mockResolvedValue(new Map()),
    };

    const module = await Test.createTestingModule({
      providers: [
        PermissionsService,
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
      ],
    }).compile();

    service = module.get(PermissionsService);
  });

  describe('hasGlobal', () => {
    it('returns false for an anonymous (undefined) user', async () => {
      expect(await service.hasGlobal(undefined, 'tag.create')).toBe(false);
    });

    it('returns true for an admin regardless of any permission grant', async () => {
      const admin = buildUser({ role: 'admin' });
      expect(await service.hasGlobal(admin, 'user.manage')).toBe(true);
      expect(groupsRepository.findGroupIdsForUser).not.toHaveBeenCalled();
    });

    it('returns true for an inactive admin (literal rule order: admin check before isActive check)', async () => {
      const inactiveAdmin = buildUser({ role: 'admin', isActive: false });
      expect(await service.hasGlobal(inactiveAdmin, 'user.manage')).toBe(true);
    });

    it('returns false for an inactive non-admin user even if they hold the permission directly', async () => {
      const inactiveMember = buildUser({ isActive: false });
      subjectPermissionsRepository.findForUser.mockResolvedValue([
        'tag.create',
      ]);
      expect(await service.hasGlobal(inactiveMember, 'tag.create')).toBe(false);
    });

    it('returns true when the permission is granted directly to the user', async () => {
      const member = buildUser();
      subjectPermissionsRepository.findForUser.mockResolvedValue([
        'tag.create',
      ]);
      expect(await service.hasGlobal(member, 'tag.create')).toBe(true);
    });

    it("returns true when the permission is granted only via one of the user's groups", async () => {
      const member = buildUser();
      groupsRepository.findGroupIdsForUser.mockResolvedValue(['group-a']);
      subjectPermissionsRepository.findForGroups.mockResolvedValue([
        'tag.create',
      ]);
      expect(await service.hasGlobal(member, 'tag.create')).toBe(true);
      expect(subjectPermissionsRepository.findForGroups).toHaveBeenCalledWith([
        'group-a',
      ]);
    });

    it('unions permissions granted via two different groups', async () => {
      const member = buildUser();
      groupsRepository.findGroupIdsForUser.mockResolvedValue([
        'group-a',
        'group-b',
      ]);
      subjectPermissionsRepository.findForGroups.mockResolvedValue([
        'tag.create',
        'media.upload',
      ]);
      expect(await service.hasGlobal(member, 'media.upload')).toBe(true);
    });

    it('returns false when neither direct nor group permissions grant it', async () => {
      const member = buildUser();
      expect(await service.hasGlobal(member, 'tag.create')).toBe(false);
    });
  });

  describe('getEffectiveGlobalPermissions', () => {
    it('returns every permission for an admin', async () => {
      const admin = buildUser({ role: 'admin' });
      const result = await service.getEffectiveGlobalPermissions(admin);
      expect(result).toContain('user.manage');
      expect(result).toContain('page.create_root');
      expect(result.length).toBe(7);
    });

    it('returns an empty array for an anonymous user', async () => {
      expect(await service.getEffectiveGlobalPermissions(undefined)).toEqual(
        [],
      );
    });

    it('returns the union of direct and group permissions, deduplicated', async () => {
      const member = buildUser();
      groupsRepository.findGroupIdsForUser.mockResolvedValue(['group-a']);
      subjectPermissionsRepository.findForUser.mockResolvedValue([
        'tag.create',
      ]);
      subjectPermissionsRepository.findForGroups.mockResolvedValue([
        'tag.create',
        'media.upload',
      ]);
      const result = await service.getEffectiveGlobalPermissions(member);
      expect(new Set(result)).toEqual(new Set(['tag.create', 'media.upload']));
    });
  });

  describe('can', () => {
    function chainFor(
      pageId: string,
      visibility: 'public' | 'private',
      chainIds: string[],
    ) {
      return new Map([[pageId, { pageId, visibility, chainIds }]]);
    }

    it('returns false when the page does not exist', async () => {
      pageHierarchyRepository.findChains.mockResolvedValue(new Map());
      expect(await service.can(buildUser(), 'page.read', 'missing')).toBe(
        false,
      );
    });

    it('grants page.read on a public page to an anonymous user', async () => {
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('p1', 'public', ['p1']),
      );
      expect(await service.can(undefined, 'page.read', 'p1')).toBe(true);
    });

    it('denies page.edit on a public page to an anonymous user', async () => {
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('p1', 'public', ['p1']),
      );
      expect(await service.can(undefined, 'page.edit', 'p1')).toBe(false);
    });

    it('denies page.read on a private page to an anonymous user', async () => {
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('p1', 'private', ['p1']),
      );
      expect(await service.can(undefined, 'page.read', 'p1')).toBe(false);
    });

    it('grants page.read on a public page to an inactive user, but denies page.edit', async () => {
      const inactiveMember = buildUser({ isActive: false });
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('p1', 'public', ['p1']),
      );
      expect(await service.can(inactiveMember, 'page.read', 'p1')).toBe(true);
      expect(await service.can(inactiveMember, 'page.edit', 'p1')).toBe(false);
    });

    it('grants everything to an admin, including on a private page', async () => {
      const admin = buildUser({ role: 'admin' });
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('p1', 'private', ['p1']),
      );
      expect(await service.can(admin, 'page.delete', 'p1')).toBe(true);
    });

    it('grants everything to an inactive admin (literal rule order)', async () => {
      const inactiveAdmin = buildUser({ role: 'admin', isActive: false });
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('p1', 'private', ['p1']),
      );
      expect(await service.can(inactiveAdmin, 'page.delete', 'p1')).toBe(true);
    });

    it('grants an action via a direct user rule scoped to exactly this page', async () => {
      const member = buildUser();
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('p1', 'private', ['p1']),
      );
      pageAccessRulesRepository.findByUserId.mockResolvedValue([
        buildRule({
          userId: member.id,
          pageId: 'p1',
          appliesTo: 'page',
          actions: ['page.edit'],
        }),
      ]);
      expect(await service.can(member, 'page.edit', 'p1')).toBe(true);
      expect(await service.can(member, 'page.delete', 'p1')).toBe(false);
    });

    it('page.edit implies page.read even when the rule only lists page.edit', async () => {
      const member = buildUser();
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('p1', 'private', ['p1']),
      );
      pageAccessRulesRepository.findByUserId.mockResolvedValue([
        buildRule({
          userId: member.id,
          pageId: 'p1',
          appliesTo: 'page',
          actions: ['page.edit'],
        }),
      ]);
      expect(await service.can(member, 'page.read', 'p1')).toBe(true);
    });

    it('grants an action via a subtree rule rooted at an ancestor of the target page', async () => {
      const member = buildUser();
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('child', 'private', ['child', 'parent', 'root']),
      );
      pageAccessRulesRepository.findByUserId.mockResolvedValue([
        buildRule({
          userId: member.id,
          pageId: 'parent',
          appliesTo: 'subtree',
          actions: ['page.edit'],
        }),
      ]);
      expect(await service.can(member, 'page.edit', 'child')).toBe(true);
    });

    it('grants an action via a whole-wiki rule (pageId null, subtree)', async () => {
      const member = buildUser();
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('child', 'private', ['child', 'parent', 'root']),
      );
      pageAccessRulesRepository.findByUserId.mockResolvedValue([
        buildRule({
          userId: member.id,
          pageId: null,
          appliesTo: 'subtree',
          actions: ['page.edit'],
        }),
      ]);
      expect(await service.can(member, 'page.edit', 'child')).toBe(true);
    });

    it('grants an action via a group rule when the user is not the direct grantee', async () => {
      const member = buildUser();
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('p1', 'private', ['p1']),
      );
      groupsRepository.findGroupIdsForUser.mockResolvedValue(['group-a']);
      pageAccessRulesRepository.findByGroupIds.mockResolvedValue([
        buildRule({
          groupId: 'group-a',
          pageId: 'p1',
          appliesTo: 'page',
          actions: ['page.edit'],
        }),
      ]);
      expect(await service.can(member, 'page.edit', 'p1')).toBe(true);
      expect(pageAccessRulesRepository.findByGroupIds).toHaveBeenCalledWith([
        'group-a',
      ]);
    });

    it('unions a direct rule and a group rule covering different actions on the same page', async () => {
      const member = buildUser();
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('p1', 'private', ['p1']),
      );
      groupsRepository.findGroupIdsForUser.mockResolvedValue(['group-a']);
      pageAccessRulesRepository.findByUserId.mockResolvedValue([
        buildRule({
          id: 'rule-direct',
          userId: member.id,
          pageId: 'p1',
          appliesTo: 'page',
          actions: ['page.edit'],
        }),
      ]);
      pageAccessRulesRepository.findByGroupIds.mockResolvedValue([
        buildRule({
          id: 'rule-group',
          groupId: 'group-a',
          pageId: 'p1',
          appliesTo: 'page',
          actions: ['page.delete'],
        }),
      ]);
      expect(await service.can(member, 'page.edit', 'p1')).toBe(true);
      expect(await service.can(member, 'page.delete', 'p1')).toBe(true);
    });

    it('unions rules from two different groups', async () => {
      const member = buildUser();
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('p1', 'private', ['p1']),
      );
      groupsRepository.findGroupIdsForUser.mockResolvedValue([
        'group-a',
        'group-b',
      ]);
      pageAccessRulesRepository.findByGroupIds.mockResolvedValue([
        buildRule({
          id: 'rule-a',
          groupId: 'group-a',
          pageId: 'p1',
          appliesTo: 'page',
          actions: ['page.edit'],
        }),
        buildRule({
          id: 'rule-b',
          groupId: 'group-b',
          pageId: 'p1',
          appliesTo: 'page',
          actions: ['page.delete'],
        }),
      ]);
      expect(await service.can(member, 'page.edit', 'p1')).toBe(true);
      expect(await service.can(member, 'page.delete', 'p1')).toBe(true);
    });

    it('denies a page-only rule for a descendant page', async () => {
      const member = buildUser();
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('child', 'private', ['child', 'parent']),
      );
      pageAccessRulesRepository.findByUserId.mockResolvedValue([
        buildRule({
          userId: member.id,
          pageId: 'parent',
          appliesTo: 'page',
          actions: ['page.edit'],
        }),
      ]);
      expect(await service.can(member, 'page.edit', 'child')).toBe(false);
    });

    it('blocks a subtree rule when the target page itself is excluded', async () => {
      const member = buildUser();
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('child', 'private', ['child', 'parent']),
      );
      pageAccessRulesRepository.findByUserId.mockResolvedValue([
        buildRule({
          id: 'rule-1',
          userId: member.id,
          pageId: 'parent',
          appliesTo: 'subtree',
          actions: ['page.edit'],
        }),
      ]);
      pageAccessRulesRepository.findExclusionsForRules.mockResolvedValue(
        new Map([['rule-1', ['child']]]),
      );
      expect(await service.can(member, 'page.edit', 'child')).toBe(false);
    });

    it('blocks a subtree rule for a page under an excluded intermediate ancestor', async () => {
      const member = buildUser();
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('grandchild', 'private', ['grandchild', 'child', 'parent']),
      );
      pageAccessRulesRepository.findByUserId.mockResolvedValue([
        buildRule({
          id: 'rule-1',
          userId: member.id,
          pageId: 'parent',
          appliesTo: 'subtree',
          actions: ['page.edit'],
        }),
      ]);
      pageAccessRulesRepository.findExclusionsForRules.mockResolvedValue(
        new Map([['rule-1', ['child']]]),
      );
      expect(await service.can(member, 'page.edit', 'grandchild')).toBe(false);
    });

    it("does not block a subtree rule when the exclusion is outside the rule's own subtree (above its root)", async () => {
      const member = buildUser();
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('child', 'private', ['child', 'parent', 'grandparent']),
      );
      pageAccessRulesRepository.findByUserId.mockResolvedValue([
        buildRule({
          id: 'rule-1',
          userId: member.id,
          pageId: 'parent',
          appliesTo: 'subtree',
          actions: ['page.edit'],
        }),
      ]);
      // "grandparent" is above the rule's own root ("parent"), so excluding it must not affect this rule.
      pageAccessRulesRepository.findExclusionsForRules.mockResolvedValue(
        new Map([['rule-1', ['grandparent']]]),
      );
      expect(await service.can(member, 'page.edit', 'child')).toBe(true);
    });

    it('covers a page created after the rule, under an already-covered subtree', async () => {
      const member = buildUser();
      // The rule was created first, scoped to "parent". "new-child" is a page
      // created afterwards under "parent" — coverage is computed live from
      // the ancestor chain at call time, so it's covered automatically.
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('new-child', 'private', ['new-child', 'parent']),
      );
      pageAccessRulesRepository.findByUserId.mockResolvedValue([
        buildRule({
          userId: member.id,
          pageId: 'parent',
          appliesTo: 'subtree',
          actions: ['page.edit'],
        }),
      ]);
      expect(await service.can(member, 'page.edit', 'new-child')).toBe(true);
    });

    it('denies a subtree rule for a page outside its subtree (a sibling of the rule root)', async () => {
      const member = buildUser();
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('sibling', 'private', ['sibling', 'root']),
      );
      pageAccessRulesRepository.findByUserId.mockResolvedValue([
        buildRule({
          userId: member.id,
          pageId: 'parent',
          appliesTo: 'subtree',
          actions: ['page.edit'],
        }),
      ]);
      expect(await service.can(member, 'page.edit', 'sibling')).toBe(false);
    });

    it('denies page.read on a private page to an active member with no covering rule', async () => {
      const member = buildUser();
      pageHierarchyRepository.findChains.mockResolvedValue(
        chainFor('p1', 'private', ['p1']),
      );
      expect(await service.can(member, 'page.read', 'p1')).toBe(false);
      expect(await service.getEffectivePageActions(member, 'p1')).toEqual([]);
    });
  });

  describe('getEffectivePageActions', () => {
    it('returns every action for an admin', async () => {
      const admin = buildUser({ role: 'admin' });
      pageHierarchyRepository.findChains.mockResolvedValue(
        new Map([
          ['p1', { pageId: 'p1', visibility: 'private', chainIds: ['p1'] }],
        ]),
      );
      const result = await service.getEffectivePageActions(admin, 'p1');
      expect(result.sort()).toEqual(
        [
          'page.create_child',
          'page.delete',
          'page.edit',
          'page.manage_permissions',
          'page.manage_tags',
          'page.manage_visibility',
          'page.move',
          'page.read',
          'page.restore_version',
        ].sort(),
      );
    });

    it('returns just page.read for an anonymous user on a public page', async () => {
      pageHierarchyRepository.findChains.mockResolvedValue(
        new Map([
          ['p1', { pageId: 'p1', visibility: 'public', chainIds: ['p1'] }],
        ]),
      );
      expect(await service.getEffectivePageActions(undefined, 'p1')).toEqual([
        'page.read',
      ]);
    });

    it('returns an empty array for a nonexistent page', async () => {
      pageHierarchyRepository.findChains.mockResolvedValue(new Map());
      expect(
        await service.getEffectivePageActions(buildUser(), 'missing'),
      ).toEqual([]);
    });

    it('returns the union of the public floor and rule-granted actions for an active member', async () => {
      const member = buildUser();
      pageHierarchyRepository.findChains.mockResolvedValue(
        new Map([
          ['p1', { pageId: 'p1', visibility: 'public', chainIds: ['p1'] }],
        ]),
      );
      pageAccessRulesRepository.findByUserId.mockResolvedValue([
        buildRule({
          userId: member.id,
          pageId: 'p1',
          appliesTo: 'page',
          actions: ['page.edit'],
        }),
      ]);
      const result = await service.getEffectivePageActions(member, 'p1');
      expect(new Set(result)).toEqual(new Set(['page.read', 'page.edit']));
    });

    it('returns just page.read for an inactive user on a public page', async () => {
      const inactiveMember = buildUser({ isActive: false });
      pageHierarchyRepository.findChains.mockResolvedValue(
        new Map([
          ['p1', { pageId: 'p1', visibility: 'public', chainIds: ['p1'] }],
        ]),
      );
      expect(
        await service.getEffectivePageActions(inactiveMember, 'p1'),
      ).toEqual(['page.read']);
    });

    it('returns every action for an inactive admin', async () => {
      const inactiveAdmin = buildUser({ role: 'admin', isActive: false });
      pageHierarchyRepository.findChains.mockResolvedValue(
        new Map([
          ['p1', { pageId: 'p1', visibility: 'private', chainIds: ['p1'] }],
        ]),
      );
      const result = await service.getEffectivePageActions(inactiveAdmin, 'p1');
      expect(result.length).toBe(9);
    });
  });

  describe('filterReadable', () => {
    it('returns an empty array for an empty input without querying anything', async () => {
      expect(await service.filterReadable(buildUser(), [])).toEqual([]);
      expect(pageHierarchyRepository.findChains).not.toHaveBeenCalled();
    });

    it('returns every page for an admin without loading rule context', async () => {
      const admin = buildUser({ role: 'admin' });
      const pages = [
        buildPage({ id: 'p1' }),
        buildPage({ id: 'p2', visibility: 'private' }),
      ];
      pageHierarchyRepository.findChains.mockResolvedValue(
        new Map([
          ['p1', { pageId: 'p1', visibility: 'public', chainIds: ['p1'] }],
          ['p2', { pageId: 'p2', visibility: 'private', chainIds: ['p2'] }],
        ]),
      );
      const result = await service.filterReadable(admin, pages);
      expect(result).toEqual(pages);
      expect(groupsRepository.findGroupIdsForUser).not.toHaveBeenCalled();
    });

    it('keeps public pages and drops private pages for an anonymous caller', async () => {
      const pages = [
        buildPage({ id: 'pub', visibility: 'public' }),
        buildPage({ id: 'priv', visibility: 'private' }),
      ];
      pageHierarchyRepository.findChains.mockResolvedValue(
        new Map([
          ['pub', { pageId: 'pub', visibility: 'public', chainIds: ['pub'] }],
          [
            'priv',
            { pageId: 'priv', visibility: 'private', chainIds: ['priv'] },
          ],
        ]),
      );
      const result = await service.filterReadable(undefined, pages);
      expect(result.map((p) => p.id)).toEqual(['pub']);
    });

    it('keeps a private page the member has a direct read rule for', async () => {
      const member = buildUser();
      const pages = [buildPage({ id: 'priv', visibility: 'private' })];
      pageHierarchyRepository.findChains.mockResolvedValue(
        new Map([
          [
            'priv',
            { pageId: 'priv', visibility: 'private', chainIds: ['priv'] },
          ],
        ]),
      );
      pageAccessRulesRepository.findByUserId.mockResolvedValue([
        buildRule({
          userId: member.id,
          pageId: 'priv',
          appliesTo: 'page',
          actions: ['page.read'],
        }),
      ]);
      const result = await service.filterReadable(member, pages);
      expect(result.map((p) => p.id)).toEqual(['priv']);
    });

    it('makes a constant number of repository calls regardless of page count', async () => {
      const member = buildUser();
      const pages = Array.from({ length: 100 }, (_, i) =>
        buildPage({ id: `p${i}`, visibility: 'private' }),
      );
      pageHierarchyRepository.findChains.mockResolvedValue(
        new Map(
          pages.map((p) => [
            p.id,
            { pageId: p.id, visibility: 'private' as const, chainIds: [p.id] },
          ]),
        ),
      );
      pageAccessRulesRepository.findByUserId.mockResolvedValue([
        buildRule({
          id: 'rule-1',
          userId: member.id,
          pageId: null,
          appliesTo: 'subtree',
          actions: ['page.read'],
        }),
      ]);
      pageAccessRulesRepository.findExclusionsForRules.mockResolvedValue(
        new Map([['rule-1', ['p50']]]),
      );
      const result = await service.filterReadable(member, pages);
      expect(result.map((p) => p.id)).not.toContain('p50');
      expect(result.length).toBe(99);
      expect(pageHierarchyRepository.findChains).toHaveBeenCalledTimes(1);
      expect(groupsRepository.findGroupIdsForUser).toHaveBeenCalledTimes(1);
      expect(subjectPermissionsRepository.findForUser).toHaveBeenCalledTimes(1);
      expect(subjectPermissionsRepository.findForGroups).toHaveBeenCalledTimes(
        1,
      );
      expect(pageAccessRulesRepository.findByUserId).toHaveBeenCalledTimes(1);
      expect(pageAccessRulesRepository.findByGroupIds).toHaveBeenCalledTimes(1);
      expect(
        pageAccessRulesRepository.findExclusionsForRules,
      ).toHaveBeenCalledTimes(1);
    });

    it('keeps only public pages for an inactive user, even with a covering rule on a private page', async () => {
      const inactiveMember = buildUser({ isActive: false });
      const pages = [
        buildPage({ id: 'pub', visibility: 'public' }),
        buildPage({ id: 'priv', visibility: 'private' }),
      ];
      pageHierarchyRepository.findChains.mockResolvedValue(
        new Map([
          ['pub', { pageId: 'pub', visibility: 'public', chainIds: ['pub'] }],
          [
            'priv',
            { pageId: 'priv', visibility: 'private', chainIds: ['priv'] },
          ],
        ]),
      );
      pageAccessRulesRepository.findByUserId.mockResolvedValue([
        buildRule({
          userId: inactiveMember.id,
          pageId: 'priv',
          appliesTo: 'page',
          actions: ['page.read'],
        }),
      ]);
      const result = await service.filterReadable(inactiveMember, pages);
      expect(result.map((p) => p.id)).toEqual(['pub']);
    });
  });

  describe('explain', () => {
    it('reports granted: false with no sources for a nonexistent page', async () => {
      pageHierarchyRepository.findChains.mockResolvedValue(new Map());
      const result = await service.explain(buildUser(), 'page.edit', 'missing');
      expect(result).toEqual({ granted: false, sources: [] });
    });

    it('reports granted: false for an inactive user, even with a covering rule on the page', async () => {
      const inactiveMember = buildUser({ isActive: false });
      pageHierarchyRepository.findChains.mockResolvedValue(
        new Map([
          ['p1', { pageId: 'p1', visibility: 'private', chainIds: ['p1'] }],
        ]),
      );
      pageAccessRulesRepository.findByUserId.mockResolvedValue([
        buildRule({
          userId: inactiveMember.id,
          pageId: 'p1',
          appliesTo: 'page',
          actions: ['page.edit'],
        }),
      ]);
      const result = await service.explain(inactiveMember, 'page.edit', 'p1');
      expect(result).toEqual({ granted: false, sources: [] });
    });

    it('reports the admin origin for an admin', async () => {
      const admin = buildUser({ role: 'admin' });
      pageHierarchyRepository.findChains.mockResolvedValue(
        new Map([
          ['p1', { pageId: 'p1', visibility: 'private', chainIds: ['p1'] }],
        ]),
      );
      const result = await service.explain(admin, 'page.delete', 'p1');
      expect(result.granted).toBe(true);
      expect(result.sources).toEqual([
        {
          origin: 'admin',
          ruleId: null,
          pageId: null,
          appliesTo: null,
          excludedPageIds: [],
          groupId: null,
          groupName: null,
        },
      ]);
    });

    it('reports the public origin for page.read on a public page', async () => {
      pageHierarchyRepository.findChains.mockResolvedValue(
        new Map([
          ['p1', { pageId: 'p1', visibility: 'public', chainIds: ['p1'] }],
        ]),
      );
      const result = await service.explain(undefined, 'page.read', 'p1');
      expect(result.granted).toBe(true);
      expect(result.sources[0].origin).toBe('public');
    });

    it('distinguishes a direct source from a group source', async () => {
      const member = buildUser();
      pageHierarchyRepository.findChains.mockResolvedValue(
        new Map([
          ['p1', { pageId: 'p1', visibility: 'private', chainIds: ['p1'] }],
        ]),
      );
      groupsRepository.findGroupIdsForUser.mockResolvedValue(['group-a']);
      groupsRepository.findByIds.mockResolvedValue([
        {
          id: 'group-a',
          name: 'Éditeurs',
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      pageAccessRulesRepository.findByUserId.mockResolvedValue([
        buildRule({
          id: 'rule-direct',
          userId: member.id,
          pageId: 'p1',
          appliesTo: 'page',
          actions: ['page.edit'],
        }),
      ]);
      pageAccessRulesRepository.findByGroupIds.mockResolvedValue([
        buildRule({
          id: 'rule-group',
          groupId: 'group-a',
          pageId: 'p1',
          appliesTo: 'page',
          actions: ['page.edit'],
        }),
      ]);
      const result = await service.explain(member, 'page.edit', 'p1');
      expect(result.granted).toBe(true);
      const origins = result.sources.map((s) => s.origin).sort();
      expect(origins).toEqual(['direct', 'group']);
      const groupSource = result.sources.find((s) => s.origin === 'group');
      expect(groupSource?.groupId).toBe('group-a');
      expect(groupSource?.groupName).toBe('Éditeurs');
    });

    it('reports granted: false with no sources when nothing covers the action', async () => {
      const member = buildUser();
      pageHierarchyRepository.findChains.mockResolvedValue(
        new Map([
          ['p1', { pageId: 'p1', visibility: 'private', chainIds: ['p1'] }],
        ]),
      );
      const result = await service.explain(member, 'page.edit', 'p1');
      expect(result).toEqual({ granted: false, sources: [] });
    });

    it('reports the implied page.read as granted, sourced from a rule that only lists page.edit', async () => {
      const member = buildUser();
      pageHierarchyRepository.findChains.mockResolvedValue(
        new Map([
          ['p1', { pageId: 'p1', visibility: 'private', chainIds: ['p1'] }],
        ]),
      );
      pageAccessRulesRepository.findByUserId.mockResolvedValue([
        buildRule({
          id: 'rule-1',
          userId: member.id,
          pageId: 'p1',
          appliesTo: 'page',
          actions: ['page.edit'],
        }),
      ]);
      const result = await service.explain(member, 'page.read', 'p1');
      expect(result.granted).toBe(true);
      expect(result.sources).toEqual([
        {
          origin: 'direct',
          ruleId: 'rule-1',
          pageId: 'p1',
          appliesTo: 'page',
          excludedPageIds: [],
          groupId: null,
          groupName: null,
        },
      ]);
    });
  });
});
