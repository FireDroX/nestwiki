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

  /** Minio object key or absolute URL. */
  @Column({ type: 'varchar', length: 500, name: 'avatar_url', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'enum', enum: USER_ROLES, default: 'member' })
  role: UserRole;

  @Column({ type: 'int', name: 'failed_login_attempts', default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'datetime', name: 'locked_until', nullable: true })
  lockedUntil: Date | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
