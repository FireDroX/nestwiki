import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseFilters,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  MCP_SCOPES,
  OAUTH_PKCE_CODE_CHALLENGE_METHOD,
  OAUTH_REGISTER_THROTTLE_LIMIT,
  OAUTH_REGISTER_THROTTLE_TTL_MS,
} from '../common/variables.global.js';
import { RegisterOAuthClientDto } from './dto/in/register-oauth-client.dto.js';
import { OAuthExceptionFilter } from './filter/oauth.exception.filter.js';
import { OAuthClientMapper } from './mapper/oauth-client.mapper.js';
import { OAuthClientsService } from './services/oauth-clients.service.js';
import { resolveRequestBaseUrl } from './utils/request-base-url.util.js';

@ApiExcludeController()
@Controller()
@UseFilters(OAuthExceptionFilter)
export class OAuthDiscoveryController {
  constructor(private readonly oauthClientsService: OAuthClientsService) {}

  @Get('.well-known/oauth-protected-resource')
  getProtectedResourceMetadata(@Req() req: Request) {
    const baseUrl = resolveRequestBaseUrl(req);
    return {
      resource: `${baseUrl}/api/mcp`,
      authorization_servers: [baseUrl],
    };
  }

  @Get('.well-known/oauth-authorization-server')
  getAuthorizationServerMetadata(@Req() req: Request) {
    const baseUrl = resolveRequestBaseUrl(req);
    return {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/api/oauth/authorize`,
      token_endpoint: `${baseUrl}/api/oauth/token`,
      registration_endpoint: `${baseUrl}/api/oauth/register`,
      revocation_endpoint: `${baseUrl}/api/oauth/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: [OAUTH_PKCE_CODE_CHALLENGE_METHOD],
      scopes_supported: MCP_SCOPES,
      token_endpoint_auth_methods_supported: ['client_secret_post'],
    };
  }

  @Post('oauth/register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({
    default: {
      limit: OAUTH_REGISTER_THROTTLE_LIMIT,
      ttl: OAUTH_REGISTER_THROTTLE_TTL_MS,
    },
  })
  async register(@Body() dto: RegisterOAuthClientDto) {
    const { entity, plainSecret } =
      await this.oauthClientsService.register(dto);
    return OAuthClientMapper.toRegisteredResponse(entity, plainSecret);
  }
}
