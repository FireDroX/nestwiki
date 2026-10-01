import { Entity, PrimaryColumn } from 'typeorm';

@Entity('page_access_exclusions')
export class PageAccessExclusion {
  @PrimaryColumn({ type: 'uuid', name: 'rule_id', length: 36 })
  ruleId: string;

  @PrimaryColumn({ type: 'uuid', name: 'page_id', length: 36 })
  pageId: string;
}
