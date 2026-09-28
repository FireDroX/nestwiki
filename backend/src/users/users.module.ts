import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityModule } from '../activity/activity.module.js';
import { AdminModule } from '../admin/admin.module.js';
import { CommentsModule } from '../comments/comments.module.js';
import { PagesModule } from '../pages/pages.module.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { User } from './entities/user.entity.js';
import { TypeormUserRepository } from './persistence/typeorm.user.repository.js';
import { UsersService } from './services/users.service.js';
import { AdminUsersController, UsersController } from './users.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    AdminModule,
    ActivityModule,
    StorageModule,
    forwardRef(() => CommentsModule),
    forwardRef(() => PagesModule),
    forwardRef(() => PermissionsModule),
  ],
  controllers: [UsersController, AdminUsersController],
  providers: [
    { provide: 'UsersRepository', useClass: TypeormUserRepository },
    {
      provide: 'AvatarBucket',
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('MINIO_BUCKET')!,
    },
    UsersService,
  ],
  exports: [UsersService],
})
export class UsersModule {}
