import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import { UsersService } from '../../users/services/users.service.js';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator.js';
import { InsufficientPermissionException } from '../exceptions/insufficient-permission.exception.js';
import { GlobalPermission } from '../permissions.js';
import { AuthenticatedUser } from '../strategies/jwt.strategy.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<GlobalPermission[]>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authUser = request.user as AuthenticatedUser | undefined;
    if (!authUser) {
      throw new InsufficientPermissionException();
    }

    const user = await this.usersService
      .findById(authUser.id)
      .catch(() => null);
    if (!user) {
      throw new InsufficientPermissionException();
    }

    for (const permission of required) {
      if (!(await this.permissionsService.hasGlobal(user, permission))) {
        throw new InsufficientPermissionException();
      }
    }

    return true;
  }
}
