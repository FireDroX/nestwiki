import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from '../admin/admin.module.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { UsersModule } from '../users/users.module.js';
import { GroupMember } from './entities/group-member.entity.js';
import { GroupPermission } from './entities/group-permission.entity.js';
import { Group } from './entities/group.entity.js';
import { PageAccessExclusion } from './entities/page-access-exclusion.entity.js';
import { PageAccessRule } from './entities/page-access-rule.entity.js';
import { UserPermission } from './entities/user-permission.entity.js';
import { GroupsController } from './groups.controller.js';
import { TypeormGroupsRepository } from './persistence/typeorm.groups.repository.js';
import { TypeormPageAccessRulesRepository } from './persistence/typeorm.page-access-rules.repository.js';
import { TypeormPageHierarchyRepository } from './persistence/typeorm.page-hierarchy.repository.js';
import { TypeormSubjectPermissionsRepository } from './persistence/typeorm.subject-permissions.repository.js';
import { AccessRulesService } from './services/access-rules.service.js';
import { GroupsService } from './services/groups.service.js';
import { PermissionsService } from './services/permissions.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Group,
      GroupMember,
      UserPermission,
      GroupPermission,
      PageAccessRule,
      PageAccessExclusion,
    ]),
    forwardRef(() => UsersModule),
    AdminModule,
  ],
  controllers: [GroupsController],
  providers: [
    { provide: 'GroupsRepository', useClass: TypeormGroupsRepository },
    {
      provide: 'SubjectPermissionsRepository',
      useClass: TypeormSubjectPermissionsRepository,
    },
    {
      provide: 'PageAccessRulesRepository',
      useClass: TypeormPageAccessRulesRepository,
    },
    {
      provide: 'PageHierarchyRepository',
      useClass: TypeormPageHierarchyRepository,
    },
    PermissionsService,
    PermissionsGuard,
    GroupsService,
    AccessRulesService,
  ],
  exports: [
    'GroupsRepository',
    'SubjectPermissionsRepository',
    'PageAccessRulesRepository',
    'PageHierarchyRepository',
    PermissionsService,
    PermissionsGuard,
    GroupsService,
    AccessRulesService,
  ],
})
export class PermissionsModule {}
