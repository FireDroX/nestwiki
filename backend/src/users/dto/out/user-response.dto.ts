import type { GlobalPermission } from '../../../common/permissions.js';
import { UserRole } from '../../entities/user.entity.js';

export interface UserResponseDto {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  avatarUrl: string | null;
  createdAt: Date;
  commentsCount?: number;
  pagesCreatedCount?: number;
  pageEditsCount?: number;
  permissions?: GlobalPermission[];
  groups?: { id: string; name: string }[];
}
