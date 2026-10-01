import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const USER_ROLES = ['admin', 'member'] as const;
export type UserRole = (typeof USER_ROLES)[number];

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  /** Bcrypt hash — never returned by any output DTO. */
  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'varchar', length: 100, name: 'display_name' })
  displayName: string;

  /** File extension of the avatar stored in Minio (key: avatars/{id}/avatar.{ext}), null if none. */
  @Column({
    type: 'varchar',
    length: 10,
    name: 'avatar_extension',
    nullable: true,
  })
  avatarExtension: string | null;

  @Column({ type: 'enum', enum: USER_ROLES, default: 'member' })
  role: UserRole;

  @Column({ type: 'int', name: 'failed_login_attempts', default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'datetime', name: 'locked_until', nullable: true })
  lockedUntil: Date | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({
    type: 'datetime',
    name: 'password_changed_at',
    nullable: true,
  })
  passwordChangedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
