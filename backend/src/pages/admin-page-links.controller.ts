import { Controller, Get, Query, UseFilters, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { ResponseDto } from '../common/dto/response.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { ListBrokenPageLinksQueryDto } from './dto/in/list-broken-page-links-query.dto.js';
import { BrokenPageLinkListDto } from './dto/out/broken-page-link-response.dto.js';
import { PagesExceptionFilter } from './filter/pages-exception.filter.js';
import { PageMapper } from './mapper/page.mapper.js';
import { PageLinksService } from './services/page-links.service.js';

@ApiTags('Admin — Liens')
@ApiBearerAuth()
@Controller('admin/links')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@UseFilters(PagesExceptionFilter)
export class AdminPageLinksController {
  constructor(private readonly pageLinksService: PageLinksService) {}

  @Get('broken')
  @ApiOperation({ summary: 'Liens internes cassés de tout le wiki' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({
    description:
      'Liens vers une page inexistante ou en corbeille, triés par page source.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Rôle admin requis.',
    type: ErrorResponseDto,
  })
  async listBroken(
    @Query() query: ListBrokenPageLinksQueryDto,
  ): Promise<ResponseDto<BrokenPageLinkListDto>> {
    return PageMapper.toBrokenLinksResponse(
      await this.pageLinksService.listBroken(query),
    );
  }
}
