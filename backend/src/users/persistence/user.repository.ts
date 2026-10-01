import { CreateUserDto } from '../dto/in/create-user.dto.js';
import { UpdateProfileDto } from '../dto/in/update-profile.dto.js';
import { User, UserRole } from '../entities/user.entity.js';

export interface UserListFilters {
  search?: string;
  role?: UserRole;
  active?: boolean;
  userIds?: string[];
}

export interface AdminUpdateUserInput {
  displayName?: string;
  email?: string;
  role?: UserRole;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserDto): Promise<User>;
  update(id: string, data: UpdateProfileDto): Promise<User>;
  updateAvatar(id: string, avatarExtension: string | null): Promise<User>;
  adminUpdate(id: string, data: AdminUpdateUserInput): Promise<User>;
  findAllPaginated(
    page: number,
    limit: number,
  ): Promise<{ items: User[]; total: number }>;
  findAllFiltered(
    filters: UserListFilters,
    page: number,
    limit: number,
  ): Promise<{ items: User[]; total: number }>;
  updateRole(id: string, role: UserRole): Promise<User>;
  updateStatus(id: string, isActive: boolean): Promise<User>;
  updatePassword(id: string, passwordHash: string): Promise<User>;
  delete(id: string): Promise<void>;
  incrementFailedLoginAttempts(id: string): Promise<User>;
  lockAccount(id: string, lockedUntil: Date): Promise<User>;
  resetFailedLoginAttempts(id: string): Promise<User>;
  countActiveAdmins(): Promise<number>;
}
