import type { PageAction } from '../../../common/permissions.js';
import type { PageAccessRuleScope } from '../../entities/page-access-rule.entity.js';

export interface AccessRuleResponseDto {
  id: string;
  pageId: string | null;
  appliesTo: PageAccessRuleScope;
  actions: PageAction[];
  excludedPageIds: string[];
  grantedById: string;
  createdAt: Date;
}

export interface PageAccessRuleResponseDto extends AccessRuleResponseDto {
  inherited: boolean;
  subject: {
    type: 'user' | 'group';
    id: string;
    name: string;
  };
}
