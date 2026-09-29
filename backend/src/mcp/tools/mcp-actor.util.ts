import { InsufficientPermissionException } from '../../common/exceptions/insufficient-permission.exception.js';
import type { GlobalPermission } from '../../common/permissions.js';
import type { AuthenticatedUser } from '../../common/strategies/jwt.strategy.js';
import { User } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import type { McpToolContext } from '../registry/mcp-tools.registry.js';

export function resolveMcpUser(
  usersService: UsersService,
  ctx: McpToolContext,
): Promise<User> {
  return usersService.findById(ctx.userId);
}

export function toAuthenticatedUser(user: User): AuthenticatedUser {
  return { id: user.id, email: user.email, role: user.role };
}

export async function requireGlobalPermission(
  permissionsService: PermissionsService,
  user: User,
  permission: GlobalPermission,
): Promise<void> {
  if (!(await permissionsService.hasGlobal(user, permission))) {
    throw new InsufficientPermissionException();
  }
}
