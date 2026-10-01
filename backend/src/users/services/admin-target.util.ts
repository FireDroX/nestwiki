import { InsufficientPermissionException } from '../../common/exceptions/insufficient-permission.exception.js';
import type { AuthenticatedUser } from '../../common/strategies/jwt.strategy.js';
import { User } from '../entities/user.entity.js';

export function assertActorIsAdminToActOnAdmin(
  actor: AuthenticatedUser,
  target: User,
): void {
  if (target.role === 'admin' && actor.role !== 'admin') {
    throw new InsufficientPermissionException();
  }
}
