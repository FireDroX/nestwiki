import { InsufficientPermissionException } from '../../common/exceptions/insufficient-permission.exception.js';
import type { GlobalPermission } from '../../common/permissions.js';
import { User } from '../../users/entities/user.entity.js';
import type { PageAccessRulesRepository } from '../persistence/page-access-rules.repository.js';
import type { SubjectPermissionsRepository } from '../persistence/subject-permissions.repository.js';
import { PermissionsService } from './permissions.service.js';

export async function assertActorCanGrantGroupMembership(
  permissionsService: PermissionsService,
  subjectPermissionsRepository: SubjectPermissionsRepository,
  pageAccessRulesRepository: PageAccessRulesRepository,
  actor: User,
  groupId: string,
): Promise<void> {
  const permissions = (await subjectPermissionsRepository.findForGroup(
    groupId,
  )) as GlobalPermission[];
  for (const permission of permissions) {
    if (!(await permissionsService.hasGlobal(actor, permission))) {
      throw new InsufficientPermissionException();
    }
  }

  const rules = await pageAccessRulesRepository.findByGroupIds([groupId]);
  for (const rule of rules) {
    if (rule.pageId === null) {
      for (const action of rule.actions) {
        if (
          !(await permissionsService.hasUnrestrictedPageAccess(actor, action))
        ) {
          throw new InsufficientPermissionException();
        }
      }
      continue;
    }

    if (rule.appliesTo === 'subtree') {
      for (const action of rule.actions) {
        if (
          !(await permissionsService.hasUnrestrictedActionOnSubtree(
            actor,
            rule.pageId,
            action,
          ))
        ) {
          throw new InsufficientPermissionException();
        }
      }
      continue;
    }

    const allowed = new Set(
      await permissionsService.getEffectivePageActions(actor, rule.pageId),
    );
    if (rule.actions.some((action) => !allowed.has(action))) {
      throw new InsufficientPermissionException();
    }
  }
}
