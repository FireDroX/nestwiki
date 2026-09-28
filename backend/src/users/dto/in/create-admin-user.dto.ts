import type { GlobalPermission } from '../../../common/permissions.js';
import type { UserRole } from '../../entities/user.entity.js';

export class CreateAdminUserDto {
  email: string;
  displayName: string;
  role?: UserRole;
  groupIds?: string[];
  permissions?: GlobalPermission[];
  password?: string;
}
