import type { GlobalPermission } from '../../../common/permissions.js';
import { UserResponseDto } from './user-response.dto.js';

export interface AdminUserDetailResponseDto extends UserResponseDto {
  groups: { id: string; name: string }[];
  directPermissions: GlobalPermission[];
  lastLoginAt: Date | null;
  lockedUntil: Date | null;
  failedLoginAttempts: number;
}
