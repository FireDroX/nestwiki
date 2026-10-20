import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityModule } from '../activity/activity.module.js';
import { CommentsModule } from '../comments/comments.module.js';
import { MediaModule } from '../media/media.module.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { TagsModule } from '../tags/tags.module.js';
import { UsersModule } from '../users/users.module.js';
import { VersionsModule } from '../versions/versions.module.js';
import { AdminPageLinksController } from './admin-page-links.controller.js';
import { PageFollow } from './entities/page-follow.entity.js';
import { PageLink } from './entities/page-link.entity.js';
import { PageVersion } from './entities/page-version.entity.js';
import { Page } from './entities/page.entity.js';
import { PagesController } from './pages.controller.js';
import { TypeormPageFollowRepository } from './persistence/typeorm.page-follow.repository.js';
import { TypeormPageLinkRepository } from './persistence/typeorm.page-link.repository.js';
import { TypeormPageTrashRepository } from './persistence/typeorm.page-trash.repository.js';
import { TypeormPagesRepository } from './persistence/typeorm.page.repository.js';
import { PageExportService } from './services/page-export.service.js';
import { PageLinksInitializer } from './services/page-links.initializer.js';
import { PageLinksService } from './services/page-links.service.js';
import { PageMergeService } from './services/page-merge.service.js';
import { PageStatsService } from './services/page-stats.service.js';
import { PageTrashService } from './services/page-trash.service.js';
import { PagesService } from './services/pages.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Page, PageVersion, PageFollow, PageLink]),
    VersionsModule,
    forwardRef(() => UsersModule),
    ActivityModule,
    forwardRef(() => CommentsModule),
    forwardRef(() => TagsModule),
    forwardRef(() => MediaModule),
    PermissionsModule,
  ],
  controllers: [PagesController, AdminPageLinksController],
  providers: [
    { provide: 'PagesRepository', useClass: TypeormPagesRepository },
    { provide: 'PageFollowsRepository', useClass: TypeormPageFollowRepository },
    { provide: 'PageTrashRepository', useClass: TypeormPageTrashRepository },
    { provide: 'PageLinksRepository', useClass: TypeormPageLinkRepository },
    PagesService,
    PageExportService,
    PageLinksInitializer,
    PageLinksService,
    PageMergeService,
    PageStatsService,
    PageTrashService,
  ],
  exports: [PagesService, PageStatsService, PageTrashService],
})
export class PagesModule {}
