import {
  Injectable,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../strategies/jwt.strategy.js';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '../variables.global.js';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthenticatedUser>(
    _err: unknown,
    user: TUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser | undefined {
    if (user) {
      return user;
    }
    if (OptionalJwtAuthGuard.hasSessionCookie(context)) {
      throw new UnauthorizedException('Unauthorized');
    }
    return undefined;
  }

  private static hasSessionCookie(context: ExecutionContext): boolean {
    const cookies = context.switchToHttp().getRequest<Request>().cookies as
      Record<string, string | undefined> | undefined;
    return !!(
      cookies?.[ACCESS_TOKEN_COOKIE] || cookies?.[REFRESH_TOKEN_COOKIE]
    );
  }
}
