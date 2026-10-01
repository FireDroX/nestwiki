import type { PageAction } from '../../../common/permissions.js';

export class UpdateAccessRuleDto {
  actions?: PageAction[];
  excludedPageIds?: string[];
}
