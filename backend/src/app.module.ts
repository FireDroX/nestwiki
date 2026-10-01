import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ActivityModule } from './activity/activity.module.js';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CommentsModule } from './comments/comments.module.js';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-behind-proxy.guard.js';
import { JwtAuthModule } from './common/jwt-auth.module.js';
import { HealthModule } from './health/health.module.js';
import { McpModule } from './mcp/mcp.module.js';
import { MediaModule } from './media/media.module.js';
import { PagesModule } from './pages/pages.module.js';
import { PermissionsModule } from './permissions/permissions.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { SearchModule } from './search/search.module.js';
import { SecurityModule } from './security/security.module.js';
import { StatsModule } from './stats/stats.module.js';
import { StorageModule } from './storage/storage.module.js';
import { TagsModule } from './tags/tags.module.js';
import { UsersModule } from './users/users.module.js';
import { VersionsModule } from './versions/versions.module.js';
import { typeOrmConfig } from './config/typeorm.config.js';

const GLOBAL_THROTTLE_TTL_MS = 60000;
const GLOBAL_THROTTLE_LIMIT = 100;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: typeOrmConfig,
    }),
    ThrottlerModule.forRoot([
      { ttl: GLOBAL_THROTTLE_TTL_MS, limit: GLOBAL_THROTTLE_LIMIT },
    ]),
    JwtAuthModule,
    HealthModule,
    StorageModule,
    SecurityModule,
    UsersModule,
    AuthModule,
    TagsModule,
    PagesModule,
    PermissionsModule,
    RealtimeModule,
    VersionsModule,
    MediaModule,
    SearchModule,
    AdminModule,
    ActivityModule,
    McpModule,
    CommentsModule,
    StatsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard }],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  onModuleInit() {
    if (this.dataSource.isInitialized) {
      Logger.log('Database connected', 'TypeOrm');
    }
  }
}
