import type { GlobalPermission } from '../../../common/permissions.js';
import type { AccessRuleResponseDto } from './access-rule-response.dto.js';

export interface GroupSummaryDto {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  ruleCount: number;
}

export interface GroupMemberDto {
  id: string;
  email: string;
  displayName: string;
}

export interface GroupDetailDto {
  id: string;
  name: string;
  description: string | null;
  members: GroupMemberDto[];
  permissions: GlobalPermission[];
  rules: AccessRuleResponseDto[];
}
