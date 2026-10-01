import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('group_members')
export class GroupMember {
  @PrimaryColumn({ type: 'uuid', name: 'group_id', length: 36 })
  groupId: string;

  @PrimaryColumn({ type: 'uuid', name: 'user_id', length: 36 })
  userId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
