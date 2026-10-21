import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const PAGE_VISIBILITIES = ['public', 'private'] as const;
export type PageVisibility = (typeof PAGE_VISIBILITIES)[number];

@Entity('pages')
@Index('IDX_pages_parent_id_active_slug', ['parentId', 'activeSlug'], {
  unique: true,
})
@Index('IDX_pages_deletion_root_id', ['deletionRootId'])
export class Page {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  slug: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'uuid', name: 'parent_id', length: 36, nullable: true })
  parentId: string | null;

  @Column({
    type: 'uuid',
    name: 'current_version_id',
    length: 36,
    nullable: true,
  })
  currentVersionId: string | null;

  @Column({ type: 'boolean', name: 'comments_enabled', default: true })
  commentsEnabled: boolean;

  @Column({ type: 'int', name: 'view_count', default: 0 })
  viewCount: number;

  @Column({ type: 'enum', enum: PAGE_VISIBILITIES, default: 'private' })
  visibility: PageVisibility;

  @Column({ type: 'uuid', name: 'created_by_id', length: 36 })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @Column({ type: 'uuid', name: 'deleted_by_id', length: 36, nullable: true })
  deletedById: string | null;

  @Column({
    type: 'uuid',
    name: 'deletion_root_id',
    length: 36,
    nullable: true,
  })
  deletionRootId: string | null;

  @Column({
    type: 'uuid',
    name: 'links_version_id',
    length: 36,
    nullable: true,
    select: false,
  })
  linksVersionId?: string | null;

  @Column({
    type: 'varchar',
    name: 'active_slug',
    length: 255,
    nullable: true,
    select: false,
    insert: false,
    update: false,
    generatedType: 'STORED',
    asExpression: 'IF(`deleted_at` IS NULL, `slug`, NULL)',
  })
  activeSlug?: string | null;
}
