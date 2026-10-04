import { Module } from '@nestjs/common';
import { PagesModule } from '../pages/pages.module.js';
import { MetaController } from './meta.controller.js';
import { MetaService } from './services/meta.service.js';

@Module({
  imports: [PagesModule],
  controllers: [MetaController],
  providers: [MetaService],
})
export class MetaModule {}
