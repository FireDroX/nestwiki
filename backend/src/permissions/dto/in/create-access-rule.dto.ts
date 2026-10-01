import type { PageAction } from '../../../common/permissions.js';
import type { PageAccessRuleScope } from '../../entities/page-access-rule.entity.js';

export class CreateAccessRuleDto {
  pageId: string | null;
  appliesTo: PageAccessRuleScope;
  actions: PageAction[];
  excludedPageIds?: string[];
}
