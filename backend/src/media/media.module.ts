import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityModule } from '../activity/activity.module.js';
import { PagesModule } from '../pages/pages.module.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { UsersModule } from '../users/users.module.js';
import { Attachment } from './entities/attachment.entity.js';
import { MediaController } from './media.controller.js';
import { TypeormAttachmentsRepository } from './persistence/typeorm.attachment.repository.js';
import { MediaService } from './services/media.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attachment]),
    StorageModule,
    PagesModule,
    ActivityModule,
    PermissionsModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [MediaController],
  providers: [
    {
      provide: 'AttachmentsRepository',
      useClass: TypeormAttachmentsRepository,
    },
    {
      provide: 'MediaBucket',
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('MINIO_BUCKET')!,
    },
    MediaService,
  ],
  exports: [MediaService],
})
export class MediaModule {}
