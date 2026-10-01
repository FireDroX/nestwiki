import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityModule } from '../activity/activity.module.js';
import { CommentsModule } from '../comments/comments.module.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { TagsModule } from '../tags/tags.module.js';
import { UsersModule } from '../users/users.module.js';
import { VersionsModule } from '../versions/versions.module.js';
import { PageFollow } from './entities/page-follow.entity.js';
import { PageVersion } from './entities/page-version.entity.js';
import { Page } from './entities/page.entity.js';
import { PagesController } from './pages.controller.js';
import { TypeormPageFollowRepository } from './persistence/typeorm.page-follow.repository.js';
import { TypeormPagesRepository } from './persistence/typeorm.page.repository.js';
import { PageMergeService } from './services/page-merge.service.js';
import { PagesService } from './services/pages.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Page, PageVersion, PageFollow]),
    VersionsModule,
    forwardRef(() => UsersModule),
    ActivityModule,
    forwardRef(() => CommentsModule),
    forwardRef(() => TagsModule),
    PermissionsModule,
  ],
  controllers: [PagesController],
  providers: [
    { provide: 'PagesRepository', useClass: TypeormPagesRepository },
    { provide: 'PageFollowsRepository', useClass: TypeormPageFollowRepository },
    PagesService,
    PageMergeService,
  ],
  exports: [PagesService],
})
export class PagesModule {}
