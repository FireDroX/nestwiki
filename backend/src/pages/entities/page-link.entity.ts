import { Entity, Index, PrimaryColumn } from 'typeorm';
import { PAGE_LINK_TARGET_MAX_LENGTH } from '../../common/variables.global.js';

@Entity('page_links')
@Index('IDX_page_links_target_path', ['targetPath'])
export class PageLink {
  @PrimaryColumn({ type: 'varchar', name: 'source_page_id', length: 36 })
  sourcePageId: string;

  @PrimaryColumn({
    type: 'varchar',
    name: 'target_path',
    length: PAGE_LINK_TARGET_MAX_LENGTH,
  })
  targetPath: string;
}
