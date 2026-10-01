import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { ResponseDto } from '../common/dto/response.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { CreateTagDto } from './dto/in/create-tag.dto.js';
import { TagResponseDto, TagSummaryDto } from './dto/out/tag-response.dto.js';
import { TagsExceptionFilter } from './filter/tags.exception.filter.js';
import { TagMapper } from './mapper/tag.mapper.js';
import { TagsService } from './services/tags.service.js';

@ApiTags('Tags')
@Controller('tags')
@UseFilters(TagsExceptionFilter)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('tag.create')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer un tag' })
  @ApiBody({ type: CreateTagDto })
  @ApiCreatedResponse({ description: 'Tag créé.' })
  @ApiBadRequestResponse({
    description: 'Nom de tag invalide.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Rôle insuffisant (editor ou admin requis).',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Un tag avec ce nom existe déjà.',
    type: ErrorResponseDto,
  })
  async create(
    @Body() dto: CreateTagDto,
  ): Promise<ResponseDto<TagResponseDto>> {
    const tag = await this.tagsService.createTag(dto);
    return TagMapper.toResponse(tag);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les tags' })
  @ApiOkResponse({ description: 'Liste de tous les tags.' })
  async list(): Promise<ResponseDto<TagSummaryDto[]>> {
    const tags = await this.tagsService.listTags();
    return TagMapper.toListResponse(tags);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('tag.delete')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un tag (cascade sur les pages liées)' })
  @ApiParam({ name: 'id', description: 'Identifiant du tag' })
  @ApiNoContentResponse({ description: 'Tag supprimé.' })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Rôle admin requis.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Le tag n'existe pas.",
    type: ErrorResponseDto,
  })
  async remove(@Param('id') id: string): Promise<void> {
    await this.tagsService.deleteTag(id);
  }
}
