import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { SessionUserResolver } from '../services/session-user.resolver.js';
import type { SessionTokenPayload } from '../session-token.js';
import { ACCESS_TOKEN_COOKIE } from '../variables.global.js';
import { UserRole } from '../../users/entities/user.entity.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly sessionUserResolver: SessionUserResolver,
  ) {
    super({
      jwtFromRequest: (req: Request) =>
        (req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined) ?? null,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET')!,
    });
  }

  async validate(payload: SessionTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.sessionUserResolver.resolve(payload);
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }
    return user;
  }
}
