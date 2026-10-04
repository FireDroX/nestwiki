import { Controller, Get, Header, Param } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { MetaHtmlMapper } from './mapper/meta-html.mapper.js';
import { MetaService } from './services/meta.service.js';

@ApiTags('Meta')
@Controller('meta')
export class MetaController {
  constructor(private readonly metaService: MetaService) {}

  @Get('pages/*path')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({
    summary: "Balises meta Open Graph d'une page, pour les robots d'aperçu",
    description:
      'Public, sans authentification. Renvoie un HTML minimal ; une page privée, inconnue ou non lisible anonymement renvoie la carte par défaut du wiki.',
  })
  @ApiParam({
    name: 'path',
    description:
      'Chemin de la page (slugs séparés par "/"), ex. "documentation/guide-demarrage".',
    type: String,
  })
  @ApiOkResponse({ description: 'Document HTML contenant les balises meta.' })
  async getPageMeta(@Param('path') path: string[]): Promise<string> {
    const meta = await this.metaService.getPageMeta(path);
    return MetaHtmlMapper.toHtml(meta);
  }
}
