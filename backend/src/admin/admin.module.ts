import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuditLogController } from './audit-log.controller.js';
import { AdminAuditLog } from './entities/admin-audit-log.entity.js';
import { SystemSetting } from './entities/system-setting.entity.js';
import { TypeormAdminAuditLogRepository } from './persistence/typeorm.admin-audit-log.repository.js';
import { TypeormSystemSettingRepository } from './persistence/typeorm.system-setting.repository.js';
import {
  AdminSettingsController,
  SettingsController,
} from './settings.controller.js';
import { AdminAuditLogService } from './services/admin-audit-log.service.js';
import { SystemSettingsService } from './services/system-settings.service.js';
import { VersionCheckService } from './services/version-check.service.js';
import { AdminVersionController } from './version.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([SystemSetting, AdminAuditLog])],
  controllers: [
    SettingsController,
    AdminSettingsController,
    AdminAuditLogController,
    AdminVersionController,
  ],
  providers: [
    {
      provide: 'SystemSettingsRepository',
      useClass: TypeormSystemSettingRepository,
    },
    {
      provide: 'AdminAuditLogsRepository',
      useClass: TypeormAdminAuditLogRepository,
    },
    SystemSettingsService,
    AdminAuditLogService,
    VersionCheckService,
  ],
  exports: [AdminAuditLogService],
})
export class AdminModule {}
