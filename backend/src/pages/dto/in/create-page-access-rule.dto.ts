import type { PageAction } from '../../../common/permissions.js';
import type { PageAccessRuleScope } from '../../../permissions/entities/page-access-rule.entity.js';

export class AccessRuleSubjectDto {
  type: 'user' | 'group';
  id: string;
}

export class CreatePageAccessRuleDto {
  subject: AccessRuleSubjectDto;
  appliesTo: PageAccessRuleScope;
  actions: PageAction[];
  excludedPageIds?: string[];
}
