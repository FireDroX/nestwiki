import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityModule } from '../activity/activity.module.js';
import { AdminModule } from '../admin/admin.module.js';
import { PagesModule } from '../pages/pages.module.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { UsersModule } from '../users/users.module.js';
import {
  AdminUserCommentsController,
  CommentController,
} from './comments.controller.js';
import { Comment } from './entities/comment.entity.js';
import { TypeormCommentsRepository } from './persistence/typeorm.comment.repository.js';
import { CommentsService } from './services/comments.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment]),
    forwardRef(() => PagesModule),
    forwardRef(() => UsersModule),
    AdminModule,
    ActivityModule,
    PermissionsModule,
  ],
  controllers: [CommentController, AdminUserCommentsController],
  providers: [
    { provide: 'CommentsRepository', useClass: TypeormCommentsRepository },
    CommentsService,
  ],
  exports: [CommentsService],
})
export class CommentsModule {}
