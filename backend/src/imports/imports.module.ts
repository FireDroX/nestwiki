import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module.js';
import { MediaModule } from '../media/media.module.js';
import { PagesModule } from '../pages/pages.module.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { TagsModule } from '../tags/tags.module.js';
import { UsersModule } from '../users/users.module.js';
import { ImportsController } from './imports.controller.js';
import { TypeormImportsRepository } from './persistence/typeorm.import.repository.js';
import { ImportsService } from './services/imports.service.js';

@Module({
  imports: [
    ActivityModule,
    MediaModule,
    PagesModule,
    PermissionsModule,
    TagsModule,
    UsersModule,
  ],
  controllers: [ImportsController],
  providers: [
    { provide: 'ImportsRepository', useClass: TypeormImportsRepository },
    ImportsService,
  ],
})
export class ImportsModule {}
