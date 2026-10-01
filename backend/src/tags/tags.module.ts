import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PagesModule } from '../pages/pages.module.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { UsersModule } from '../users/users.module.js';
import { PageTag } from './entities/page-tag.entity.js';
import { Tag } from './entities/tag.entity.js';
import { TypeormTagRepository } from './persistence/typeorm.tag.repository.js';
import { TagsService } from './services/tags.service.js';
import { TagsController } from './tags.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tag, PageTag]),
    forwardRef(() => PagesModule),
    forwardRef(() => UsersModule),
    PermissionsModule,
  ],
  controllers: [TagsController],
  providers: [
    { provide: 'TagsRepository', useClass: TypeormTagRepository },
    TagsService,
  ],
  exports: [TagsService],
})
export class TagsModule {}
