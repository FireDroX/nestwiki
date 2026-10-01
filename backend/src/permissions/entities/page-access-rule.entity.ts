import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PageAction } from '../../common/permissions.js';

export const PAGE_ACCESS_RULE_SCOPES = ['page', 'subtree'] as const;
export type PageAccessRuleScope = (typeof PAGE_ACCESS_RULE_SCOPES)[number];

@Entity('page_access_rules')
@Index(['userId'])
@Index(['groupId'])
@Index(['pageId'])
export class PageAccessRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id', length: 36, nullable: true })
  userId: string | null;

  @Column({ type: 'uuid', name: 'group_id', length: 36, nullable: true })
  groupId: string | null;

  /** NULL means the whole wiki rather than one page. */
  @Column({ type: 'uuid', name: 'page_id', length: 36, nullable: true })
  pageId: string | null;

  @Column({ type: 'enum', enum: PAGE_ACCESS_RULE_SCOPES, name: 'applies_to' })
  appliesTo: PageAccessRuleScope;

  @Column({ type: 'json' })
  actions: PageAction[];

  @Column({ type: 'uuid', name: 'granted_by_id', length: 36 })
  grantedById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
