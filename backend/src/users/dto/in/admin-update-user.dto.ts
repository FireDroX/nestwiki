import type { UserRole } from '../../entities/user.entity.js';

export class AdminUpdateUserDto {
  displayName?: string;
  email?: string;
  role?: UserRole;
}
