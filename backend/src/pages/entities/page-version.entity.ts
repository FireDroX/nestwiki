import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('page_versions')
@Index(['pageId'])
export class PageVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'page_id', length: 36 })
  pageId: string;

  @Column({ type: 'mediumtext' })
  content: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'uuid', name: 'author_id', length: 36 })
  authorId: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'change_summary',
    nullable: true,
  })
  changeSummary: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
