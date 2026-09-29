import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InvalidApiKeyException } from '../../common/exceptions/mcp/invalid-api-key.exception.js';
import { UsersService } from '../../users/services/users.service.js';
import { ApiKeysService } from '../services/api-keys.service.js';
import type { McpAuthContext } from '../services/api-keys.service.js';
import type { OAuthAccessTokenPayload } from '../services/oauth-flow.service.js';
import type { McpAuthenticatedRequest } from './mcp-api-key.guard.js';

const BEARER_PREFIX = 'Bearer ';
const API_KEY_PREFIX = 'sk_';

@Injectable()
export class McpOAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<McpAuthenticatedRequest>();

    const header = request.headers.authorization;
    if (!header || !header.startsWith(BEARER_PREFIX)) {
      throw new InvalidApiKeyException();
    }

    const token = header.slice(BEARER_PREFIX.length);
    const auth = token.startsWith(API_KEY_PREFIX)
      ? await this.apiKeysService.validate(token)
      : this.verifyOAuthAccessToken(token);

    await this.assertUserActive(auth.createdById);
    request.mcpAuth = auth;
    return true;
  }

  private async assertUserActive(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId).catch(() => null);
    if (!user || !user.isActive) {
      throw new InvalidApiKeyException();
    }
  }

  private verifyOAuthAccessToken(token: string): McpAuthContext {
    try {
      const payload = this.jwtService.verify<OAuthAccessTokenPayload>(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });
      if (payload.type !== 'mcp_oauth_access') {
        throw new Error('Not an OAuth access token');
      }
      return {
        apiKeyId: `oauth:${payload.clientId}`,
        scopes: payload.scopes,
        createdById: payload.sub,
      };
    } catch {
      throw new InvalidApiKeyException();
    }
  }
}
