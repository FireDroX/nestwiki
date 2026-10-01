import { SetMetadata } from '@nestjs/common';
import { GlobalPermission } from '../permissions.js';

export const REQUIRE_PERMISSION_KEY = 'requiredPermissions';

export const RequirePermission = (...permissions: GlobalPermission[]) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permissions);
