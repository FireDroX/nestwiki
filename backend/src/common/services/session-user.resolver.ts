import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { UserRepository } from '../../users/persistence/user.repository.js';
import {
  type SessionTokenPayload,
  wasIssuedBeforePasswordChange,
} from '../session-token.js';
import type { AuthenticatedUser } from '../strategies/jwt.strategy.js';
import { SESSION_ACCESS_TOKEN_TYPE } from '../variables.global.js';

export interface VerifiedSession {
  user: AuthenticatedUser;
  expiresAt: number | null;
}

@Injectable()
export class SessionUserResolver {
  constructor(
    @Inject('UsersRepository') private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async resolve(
    payload: SessionTokenPayload,
  ): Promise<AuthenticatedUser | null> {
    if (payload.type !== SESSION_ACCESS_TOKEN_TYPE) {
      return null;
    }
    const user = await this.userRepository.findById(payload.sub);
    if (
      !user ||
      !user.isActive ||
      wasIssuedBeforePasswordChange(user, payload.iat)
    ) {
      return null;
    }
    return { id: user.id, email: user.email, role: user.role };
  }

  async verify(token: string): Promise<VerifiedSession | null> {
    let payload: SessionTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<SessionTokenPayload>(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      return null;
    }
    const user = await this.resolve(payload);
    if (!user) {
      return null;
    }
    return {
      user,
      expiresAt: payload.exp === undefined ? null : payload.exp * 1000,
    };
  }
}
