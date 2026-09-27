import { Inject, Injectable } from '@nestjs/common';
import { AdminAuditLogService } from '../../admin/services/admin-audit-log.service.js';
import { AccessRuleNotFoundException } from '../../common/exceptions/permissions/access-rule-not-found.exception.js';
import { GroupNotFoundException } from '../../common/exceptions/permissions/group-not-found.exception.js';
import { InsufficientPermissionException } from '../../common/exceptions/insufficient-permission.exception.js';
import { PageNotFoundException } from '../../common/exceptions/pages/page-not-found.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import {
  GLOBAL_PERMISSIONS,
  GlobalPermission,
  PAGE_ACTIONS,
  PageAction,
} from '../../common/permissions.js';
import { User } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import {
  PAGE_ACCESS_RULE_SCOPES,
  PageAccessRule,
  PageAccessRuleScope,
} from '../entities/page-access-rule.entity.js';
import type { GroupsRepository } from '../persistence/groups.repository.js';
import type { PageAccessRulesRepository } from '../persistence/page-access-rules.repository.js';
import type { PageHierarchyRepository } from '../persistence/page-hierarchy.repository.js';
import type { SubjectPermissionsRepository } from '../persistence/subject-permissions.repository.js';
import { PermissionsService } from './permissions.service.js';

export type AccessRuleSubject =
  { type: 'user'; id: string } | { type: 'group'; id: string };

export interface AccessRuleView {
  id: string;
  pageId: string | null;
  appliesTo: PageAccessRuleScope;
  actions: PageAction[];
  excludedPageIds: string[];
  grantedById: string;
  createdAt: Date;
}

export interface PageAccessRuleView extends AccessRuleView {
  inherited: boolean;
  subject: { type: 'user' | 'group'; id: string; name: string };
}

export interface CreateAccessRuleInput {
  pageId: string | null;
  appliesTo: PageAccessRuleScope;
  actions: PageAction[];
  excludedPageIds?: string[];
}

export interface UpdateAccessRuleInput {
  actions?: PageAction[];
  excludedPageIds?: string[];
}

@Injectable()
export class AccessRulesService {
  constructor(
    @Inject('GroupsRepository')
    private readonly groupsRepository: GroupsRepository,
    @Inject('SubjectPermissionsRepository')
    private readonly subjectPermissionsRepository: SubjectPermissionsRepository,
    @Inject('PageAccessRulesRepository')
    private readonly pageAccessRulesRepository: PageAccessRulesRepository,
    @Inject('PageHierarchyRepository')
    private readonly pageHierarchyRepository: PageHierarchyRepository,
    private readonly usersService: UsersService,
    private readonly permissionsService: PermissionsService,
    private readonly adminAuditLogService: AdminAuditLogService,
  ) {}

  async setGlobalPermissions(
    subject: AccessRuleSubject,
    permissions: GlobalPermission[],
    actorId: string,
  ): Promise<void> {
    await this.assertSubjectExists(subject);
    AccessRulesService.validateGlobalPermissions(permissions);
    const deduped = [...new Set(permissions)];

    const actor = await this.usersService.findById(actorId);
    await this.assertNoGlobalEscalation(actor, deduped);

    if (subject.type === 'user') {
      await this.subjectPermissionsRepository.setForUser(subject.id, deduped);
    } else {
      await this.subjectPermissionsRepository.setForGroup(subject.id, deduped);
    }

    await this.adminAuditLogService.record({
      adminId: actorId,
      action:
        subject.type === 'user'
          ? 'user.permissions.update'
          : 'group.permissions.update',
      targetType: subject.type,
      targetId: subject.id,
      metadata: { permissions: deduped },
    });
  }

  async listAccessRulesForSubject(
    subject: AccessRuleSubject,
  ): Promise<AccessRuleView[]> {
    const rules =
      subject.type === 'user'
        ? await this.pageAccessRulesRepository.findByUserId(subject.id)
        : await this.pageAccessRulesRepository.findByGroupIds([subject.id]);
    const exclusions =
      await this.pageAccessRulesRepository.findExclusionsForRules(
        rules.map((rule) => rule.id),
      );
    return rules.map((rule) => AccessRulesService.toView(rule, exclusions));
  }

  async createAccessRule(
    subject: AccessRuleSubject,
    dto: CreateAccessRuleInput,
    actorId: string,
  ): Promise<AccessRuleView> {
    await this.assertSubjectExists(subject);
    AccessRulesService.validateActions(dto.actions);
    AccessRulesService.validateAppliesTo(dto.appliesTo);
    await this.assertPageExists(dto.pageId);
    const excludedPageIds = await this.validateExclusions(
      dto.pageId,
      dto.appliesTo,
      dto.excludedPageIds,
    );
    const actions = AccessRulesService.normalizeActions(dto.actions);

    const actor = await this.usersService.findById(actorId);
    await this.assertNoEscalation(actor, dto.pageId, dto.appliesTo, actions);

    const rule = await this.pageAccessRulesRepository.create({
      userId: subject.type === 'user' ? subject.id : null,
      groupId: subject.type === 'group' ? subject.id : null,
      pageId: dto.pageId,
      appliesTo: dto.appliesTo,
      actions,
      grantedById: actorId,
    });
    if (excludedPageIds.length > 0) {
      await this.pageAccessRulesRepository.setExclusions(
        rule.id,
        excludedPageIds,
      );
    }

    await this.adminAuditLogService.record({
      adminId: actorId,
      action: 'access_rule.create',
      targetType: subject.type,
      targetId: subject.id,
      metadata: {
        ruleId: rule.id,
        pageId: dto.pageId,
        appliesTo: dto.appliesTo,
        actions,
        excludedPageIds,
      },
    });

    return { ...AccessRulesService.toBaseView(rule), excludedPageIds };
  }

  async updateAccessRule(
    subject: AccessRuleSubject,
    ruleId: string,
    dto: UpdateAccessRuleInput,
    actorId: string,
  ): Promise<AccessRuleView> {
    const rule = await this.findOwnedRule(subject, ruleId);
    return this.applyUpdate(rule, subject, dto, actorId);
  }

  async updateAccessRuleForPage(
    pageId: string,
    ruleId: string,
    dto: UpdateAccessRuleInput,
    actorId: string,
  ): Promise<AccessRuleView> {
    const rule = await this.findRuleDirectlyOnPage(pageId, ruleId);
    return this.applyUpdate(
      rule,
      AccessRulesService.subjectOf(rule),
      dto,
      actorId,
    );
  }

  async deleteAccessRule(
    subject: AccessRuleSubject,
    ruleId: string,
    actorId: string,
  ): Promise<void> {
    await this.findOwnedRule(subject, ruleId);
    await this.applyDelete(subject, ruleId, actorId);
  }

  async deleteAccessRuleForPage(
    pageId: string,
    ruleId: string,
    actorId: string,
  ): Promise<void> {
    const rule = await this.findRuleDirectlyOnPage(pageId, ruleId);
    await this.applyDelete(AccessRulesService.subjectOf(rule), ruleId, actorId);
  }

  async listAccessRulesForPage(pageId: string): Promise<PageAccessRuleView[]> {
    const chains = await this.pageHierarchyRepository.findChains([pageId]);
    const chain = chains.get(pageId);
    if (!chain) {
      throw new PageNotFoundException();
    }

    const candidates =
      await this.pageAccessRulesRepository.findByPageIdsOrWholeWiki(
        chain.chainIds,
      );
    const covering = candidates.filter(
      (rule) =>
        rule.pageId === pageId ||
        (rule.appliesTo === 'subtree' &&
          (rule.pageId === null || chain.chainIds.includes(rule.pageId))),
    );

    const exclusions =
      await this.pageAccessRulesRepository.findExclusionsForRules(
        covering.map((rule) => rule.id),
      );

    const userIds = [
      ...new Set(
        covering
          .filter((rule) => rule.userId)
          .map((rule) => rule.userId as string),
      ),
    ];
    const groupIds = [
      ...new Set(
        covering
          .filter((rule) => rule.groupId)
          .map((rule) => rule.groupId as string),
      ),
    ];
    const [users, groups] = await Promise.all([
      Promise.all(
        userIds.map((id) => this.usersService.findById(id).catch(() => null)),
      ),
      groupIds.length > 0
        ? this.groupsRepository.findByIds(groupIds)
        : Promise.resolve([]),
    ]);
    const userById = new Map(
      users
        .filter((user): user is User => user !== null)
        .map((user) => [user.id, user]),
    );
    const groupById = new Map(groups.map((group) => [group.id, group]));

    return covering.map((rule) => {
      const subject = rule.userId
        ? {
            type: 'user' as const,
            id: rule.userId,
            name: userById.get(rule.userId)?.displayName ?? rule.userId,
          }
        : {
            type: 'group' as const,
            id: rule.groupId as string,
            name:
              groupById.get(rule.groupId as string)?.name ??
              (rule.groupId as string),
          };
      return {
        ...AccessRulesService.toView(rule, exclusions),
        inherited: rule.pageId !== pageId,
        subject,
      };
    });
  }

  private async applyUpdate(
    rule: PageAccessRule,
    subject: AccessRuleSubject,
    dto: UpdateAccessRuleInput,
    actorId: string,
  ): Promise<AccessRuleView> {
    let actions = rule.actions;
    if (dto.actions !== undefined) {
      AccessRulesService.validateActions(dto.actions);
      actions = AccessRulesService.normalizeActions(dto.actions);
    }

    let excludedPageIds = await this.pageAccessRulesRepository.findExclusions(
      rule.id,
    );
    if (dto.excludedPageIds !== undefined) {
      excludedPageIds = await this.validateExclusions(
        rule.pageId,
        rule.appliesTo,
        dto.excludedPageIds,
      );
    }

    // Narrowing/removing an exclusion widens the rule's effective coverage
    // just as much as changing its actions does, so both must be re-checked
    // against the actor's own access — skipping this on an exclusions-only
    // update would let an actor drop an exclusion they had no right to drop.
    if (dto.actions !== undefined || dto.excludedPageIds !== undefined) {
      const actor = await this.usersService.findById(actorId);
      await this.assertNoEscalation(
        actor,
        rule.pageId,
        rule.appliesTo,
        actions,
      );
    }

    if (dto.actions !== undefined) {
      await this.pageAccessRulesRepository.updateActions(rule.id, actions);
    }
    if (dto.excludedPageIds !== undefined) {
      await this.pageAccessRulesRepository.setExclusions(
        rule.id,
        excludedPageIds,
      );
    }

    await this.adminAuditLogService.record({
      adminId: actorId,
      action: 'access_rule.update',
      targetType: subject.type,
      targetId: subject.id,
      metadata: { ruleId: rule.id, actions, excludedPageIds },
    });

    return { ...AccessRulesService.toBaseView(rule), actions, excludedPageIds };
  }

  private async applyDelete(
    subject: AccessRuleSubject,
    ruleId: string,
    actorId: string,
  ): Promise<void> {
    await this.pageAccessRulesRepository.delete(ruleId);
    await this.adminAuditLogService.record({
      adminId: actorId,
      action: 'access_rule.delete',
      targetType: subject.type,
      targetId: subject.id,
      metadata: { ruleId },
    });
  }

  private async findOwnedRule(
    subject: AccessRuleSubject,
    ruleId: string,
  ): Promise<PageAccessRule> {
    const rule = await this.pageAccessRulesRepository.findById(ruleId);
    const owns =
      rule &&
      (subject.type === 'user'
        ? rule.userId === subject.id
        : rule.groupId === subject.id);
    if (!rule || !owns) {
      throw new AccessRuleNotFoundException();
    }
    return rule;
  }

  private async findRuleDirectlyOnPage(
    pageId: string,
    ruleId: string,
  ): Promise<PageAccessRule> {
    const rule = await this.pageAccessRulesRepository.findById(ruleId);
    if (!rule || rule.pageId !== pageId) {
      throw new AccessRuleNotFoundException();
    }
    return rule;
  }

  private async assertSubjectExists(subject: AccessRuleSubject): Promise<void> {
    if (subject.type === 'user') {
      await this.usersService.findById(subject.id);
      return;
    }
    if (subject.type !== 'group') {
      throw new ValidationException(
        'subject.type must be either "user" or "group"',
      );
    }
    const group = await this.groupsRepository.findById(subject.id);
    if (!group) {
      throw new GroupNotFoundException();
    }
  }

  private async assertPageExists(pageId: string | null): Promise<void> {
    if (pageId === null) {
      return;
    }
    const chains = await this.pageHierarchyRepository.findChains([pageId]);
    if (!chains.has(pageId)) {
      throw new PageNotFoundException();
    }
  }

  private async validateExclusions(
    pageId: string | null,
    appliesTo: PageAccessRuleScope,
    excludedPageIds: string[] | undefined,
  ): Promise<string[]> {
    if (!excludedPageIds || excludedPageIds.length === 0) {
      return [];
    }
    if (appliesTo === 'page') {
      throw new ValidationException(
        'excludedPageIds is not allowed when appliesTo is "page"',
      );
    }

    const chains =
      await this.pageHierarchyRepository.findChains(excludedPageIds);
    for (const excludedId of excludedPageIds) {
      const chain = chains.get(excludedId);
      if (!chain) {
        throw new PageNotFoundException();
      }
      if (
        pageId !== null &&
        (excludedId === pageId || !chain.chainIds.includes(pageId))
      ) {
        throw new ValidationException(
          `excludedPageIds must be strict descendants of pageId (${excludedId} is not)`,
        );
      }
    }
    return excludedPageIds;
  }

  private async assertNoEscalation(
    actor: User,
    pageId: string | null,
    appliesTo: PageAccessRuleScope,
    actions: PageAction[],
  ): Promise<void> {
    if (pageId === null) {
      for (const action of actions) {
        if (
          !(await this.permissionsService.hasUnrestrictedPageAccess(
            actor,
            action,
          ))
        ) {
          throw new InsufficientPermissionException();
        }
      }
      return;
    }

    if (appliesTo === 'subtree') {
      // A subtree grant hands out `action` on pageId AND every descendant —
      // getEffectivePageActions only confirms pageId itself, so an actor
      // whose own subtree access is narrowed by an exclusion somewhere
      // inside this subtree must not be able to re-grant it unrestricted.
      for (const action of actions) {
        if (
          !(await this.permissionsService.hasUnrestrictedActionOnSubtree(
            actor,
            pageId,
            action,
          ))
        ) {
          throw new InsufficientPermissionException();
        }
      }
      return;
    }

    const allowed = new Set(
      await this.permissionsService.getEffectivePageActions(actor, pageId),
    );
    if (actions.some((action) => !allowed.has(action))) {
      throw new InsufficientPermissionException();
    }
  }

  private async assertNoGlobalEscalation(
    actor: User,
    permissions: GlobalPermission[],
  ): Promise<void> {
    for (const permission of permissions) {
      if (!(await this.permissionsService.hasGlobal(actor, permission))) {
        throw new InsufficientPermissionException();
      }
    }
  }

  private static subjectOf(rule: PageAccessRule): AccessRuleSubject {
    return rule.userId
      ? { type: 'user', id: rule.userId }
      : { type: 'group', id: rule.groupId as string };
  }

  private static toBaseView(rule: PageAccessRule): AccessRuleView {
    return {
      id: rule.id,
      pageId: rule.pageId,
      appliesTo: rule.appliesTo,
      actions: rule.actions,
      excludedPageIds: [],
      grantedById: rule.grantedById,
      createdAt: rule.createdAt,
    };
  }

  private static toView(
    rule: PageAccessRule,
    exclusions: Map<string, string[]>,
  ): AccessRuleView {
    return {
      ...AccessRulesService.toBaseView(rule),
      excludedPageIds: exclusions.get(rule.id) ?? [],
    };
  }

  private static validateActions(actions: PageAction[]): void {
    if (!actions || actions.length === 0) {
      throw new ValidationException('actions must not be empty');
    }
    const invalid = actions.filter((action) => !PAGE_ACTIONS.includes(action));
    if (invalid.length > 0) {
      throw new ValidationException(
        `actions contains invalid values: ${invalid.join(', ')}`,
      );
    }
  }

  private static validateAppliesTo(appliesTo: PageAccessRuleScope): void {
    if (!PAGE_ACCESS_RULE_SCOPES.includes(appliesTo)) {
      throw new ValidationException(
        `appliesTo must be one of the following values: ${PAGE_ACCESS_RULE_SCOPES.join(', ')}`,
      );
    }
  }

  private static validateGlobalPermissions(
    permissions: GlobalPermission[],
  ): void {
    if (!permissions || permissions.length === 0) {
      return;
    }
    const invalid = permissions.filter(
      (permission) => !GLOBAL_PERMISSIONS.includes(permission),
    );
    if (invalid.length > 0) {
      throw new ValidationException(
        `permissions contains invalid values: ${invalid.join(', ')}`,
      );
    }
  }

  private static normalizeActions(actions: PageAction[]): PageAction[] {
    const set = new Set(actions);
    if ([...set].some((action) => action !== 'page.read')) {
      set.add('page.read');
    }
    return [...set];
  }
}
