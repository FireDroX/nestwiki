import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('user_permissions')
export class UserPermission {
  @PrimaryColumn({ type: 'uuid', name: 'user_id', length: 36 })
  userId: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  permission: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
