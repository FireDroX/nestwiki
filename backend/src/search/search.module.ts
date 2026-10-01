import { forwardRef, Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { UsersModule } from '../users/users.module.js';
import { TypeormSearchRepository } from './persistence/typeorm.search.repository.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './services/search.service.js';

@Module({
  imports: [PermissionsModule, forwardRef(() => UsersModule)],
  controllers: [SearchController],
  providers: [
    { provide: 'SearchRepository', useClass: TypeormSearchRepository },
    SearchService,
  ],
  exports: [SearchService],
})
export class SearchModule {}
