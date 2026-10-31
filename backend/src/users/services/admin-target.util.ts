import { InsufficientPermissionException } from '../../common/exceptions/insufficient-permission.exception.js';
import type { GlobalPermission } from '../../common/permissions.js';
import type { AuthenticatedUser } from '../../common/strategies/jwt.strategy.js';
import type { GroupsRepository } from '../../permissions/persistence/groups.repository.js';
import type { PageAccessRulesRepository } from '../../permissions/persistence/page-access-rules.repository.js';
import type { SubjectPermissionsRepository } from '../../permissions/persistence/subject-permissions.repository.js';
import { assertActorHoldsGrants } from '../../permissions/services/group-grant.util.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import { User } from '../entities/user.entity.js';

export interface TargetGrantSources {
  permissionsService: PermissionsService;
  groupsRepository: GroupsRepository;
  subjectPermissionsRepository: SubjectPermissionsRepository;
  pageAccessRulesRepository: PageAccessRulesRepository;
}

export function assertActorIsAdminToActOnAdmin(
  actor: AuthenticatedUser,
  target: User,
): void {
  if (target.role === 'admin' && actor.role !== 'admin') {
    throw new InsufficientPermissionException();
  }
}

export async function assertActorCoversTarget(
  sources: TargetGrantSources,
  actor: User,
  target: User,
): Promise<void> {
  if (actor.role === 'admin') {
    return;
  }
  if (target.role === 'admin') {
    throw new InsufficientPermissionException();
  }

  const groupIds = await sources.groupsRepository.findGroupIdsForUser(
    target.id,
  );
  const [directPermissions, groupPermissions, directRules, groupRules] =
    await Promise.all([
      sources.subjectPermissionsRepository.findForUser(target.id),
      groupIds.length > 0
        ? sources.subjectPermissionsRepository.findForGroups(groupIds)
        : Promise.resolve([]),
      sources.pageAccessRulesRepository.findByUserId(target.id),
      groupIds.length > 0
        ? sources.pageAccessRulesRepository.findByGroupIds(groupIds)
        : Promise.resolve([]),
    ]);

  const permissions = [
    ...new Set([...directPermissions, ...groupPermissions]),
  ] as GlobalPermission[];
  await assertActorHoldsGrants(sources.permissionsService, actor, permissions, [
    ...directRules,
    ...groupRules,
  ]);
}
