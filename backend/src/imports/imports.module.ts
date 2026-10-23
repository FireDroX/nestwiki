import { Module } from '@nestjs/common';
import { PagesModule } from '../pages/pages.module.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { TagsModule } from '../tags/tags.module.js';
import { UsersModule } from '../users/users.module.js';
import { ImportsController } from './imports.controller.js';
import { ImportsService } from './services/imports.service.js';

@Module({
  imports: [PagesModule, PermissionsModule, TagsModule, UsersModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
