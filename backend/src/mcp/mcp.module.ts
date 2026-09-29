import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from '../admin/admin.module.js';
import { MediaModule } from '../media/media.module.js';
import { PagesModule } from '../pages/pages.module.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { SearchModule } from '../search/search.module.js';
import { TagsModule } from '../tags/tags.module.js';
import { UsersModule } from '../users/users.module.js';
import { McpApiKeysController } from './api-keys.controller.js';
import { McpAuditLogController } from './audit-log.controller.js';
import { OAuthClient } from './entities/oauth-client.entity.js';
import { OAuthRefreshToken } from './entities/oauth-refresh-token.entity.js';
import { McpApiKey } from './entities/mcp-api-key.entity.js';
import { McpAuditLog } from './entities/mcp-audit-log.entity.js';
import { McpApiKeyGuard } from './guards/mcp-api-key.guard.js';
import { McpOAuthGuard } from './guards/mcp-oauth.guard.js';
import { McpAuditInterceptor } from './interceptors/mcp-audit.interceptor.js';
import { McpController } from './mcp.controller.js';
import { OAuthAuthorizeController } from './oauth-authorize.controller.js';
import { OAuthClientsController } from './oauth-clients.controller.js';
import { OAuthDiscoveryController } from './oauth-discovery.controller.js';
import { OAuthTokenController } from './oauth-token.controller.js';
import { TypeormMcpApiKeyRepository } from './persistence/typeorm.mcp-api-key.repository.js';
import { TypeormMcpAuditLogRepository } from './persistence/typeorm.mcp-audit-log.repository.js';
import { TypeormOAuthClientRepository } from './persistence/typeorm.oauth-client.repository.js';
import { TypeormOAuthRefreshTokenRepository } from './persistence/typeorm.oauth-refresh-token.repository.js';
import {
  McpToolsBootstrapService,
  McpToolsRegistry,
} from './registry/mcp-tools.registry.js';
import { ApiKeysService } from './services/api-keys.service.js';
import { McpAuditService } from './services/mcp-audit.service.js';
import { McpServerService } from './services/mcp-server.service.js';
import { OAuthClientsService } from './services/oauth-clients.service.js';
import { OAuthFlowService } from './services/oauth-flow.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      McpApiKey,
      McpAuditLog,
      OAuthClient,
      OAuthRefreshToken,
    ]),
    JwtModule.register({}),
    PagesModule,
    TagsModule,
    UsersModule,
    MediaModule,
    SearchModule,
    AdminModule,
    PermissionsModule,
  ],
  controllers: [
    McpController,
    McpApiKeysController,
    McpAuditLogController,
    OAuthDiscoveryController,
    OAuthAuthorizeController,
    OAuthTokenController,
    OAuthClientsController,
  ],
  providers: [
    { provide: 'McpApiKeysRepository', useClass: TypeormMcpApiKeyRepository },
    {
      provide: 'McpAuditLogsRepository',
      useClass: TypeormMcpAuditLogRepository,
    },
    {
      provide: 'OAuthClientsRepository',
      useClass: TypeormOAuthClientRepository,
    },
    {
      provide: 'OAuthRefreshTokensRepository',
      useClass: TypeormOAuthRefreshTokenRepository,
    },
    ApiKeysService,
    McpAuditService,
    McpAuditInterceptor,
    McpApiKeyGuard,
    McpOAuthGuard,
    McpToolsRegistry,
    McpToolsBootstrapService,
    McpServerService,
    OAuthClientsService,
    OAuthFlowService,
  ],
})
export class McpModule {}
