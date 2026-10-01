import { PageAction } from '../../common/permissions.js';
import {
  PageAccessRule,
  PageAccessRuleScope,
} from '../entities/page-access-rule.entity.js';

export interface CreatePageAccessRuleInput {
  userId: string | null;
  groupId: string | null;
  pageId: string | null;
  appliesTo: PageAccessRuleScope;
  actions: PageAction[];
  grantedById: string;
}

export interface PageAccessRulesRepository {
  findByUserId(userId: string): Promise<PageAccessRule[]>;
  findByGroupIds(groupIds: string[]): Promise<PageAccessRule[]>;
  findById(id: string): Promise<PageAccessRule | null>;
  create(input: CreatePageAccessRuleInput): Promise<PageAccessRule>;
  updateActions(id: string, actions: PageAction[]): Promise<void>;
  delete(id: string): Promise<void>;
  findExclusions(ruleId: string): Promise<string[]>;
  setExclusions(ruleId: string, pageIds: string[]): Promise<void>;
  findExclusionsForRules(ruleIds: string[]): Promise<Map<string, string[]>>;
}
