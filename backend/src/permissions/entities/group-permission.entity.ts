import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('group_permissions')
export class GroupPermission {
  @PrimaryColumn({ type: 'uuid', name: 'group_id', length: 36 })
  groupId: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  permission: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
