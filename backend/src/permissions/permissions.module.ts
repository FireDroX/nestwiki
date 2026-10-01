import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupMember } from './entities/group-member.entity.js';
import { GroupPermission } from './entities/group-permission.entity.js';
import { Group } from './entities/group.entity.js';
import { PageAccessExclusion } from './entities/page-access-exclusion.entity.js';
import { PageAccessRule } from './entities/page-access-rule.entity.js';
import { UserPermission } from './entities/user-permission.entity.js';
import { TypeormGroupsRepository } from './persistence/typeorm.groups.repository.js';
import { TypeormPageAccessRulesRepository } from './persistence/typeorm.page-access-rules.repository.js';
import { TypeormSubjectPermissionsRepository } from './persistence/typeorm.subject-permissions.repository.js';

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
  ],
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
  ],
  exports: [
    'GroupsRepository',
    'SubjectPermissionsRepository',
    'PageAccessRulesRepository',
  ],
})
export class PermissionsModule {}
