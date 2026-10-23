import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { ResponseDto } from '../common/dto/response.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../common/strategies/jwt.strategy.js';
import {
  IMPORT_MAX_ARCHIVE_SIZE_BYTES,
  IMPORT_MAX_ARCHIVE_SIZE_MB,
  IMPORT_MAX_PAGES,
  IMPORT_MAX_UNCOMPRESSED_SIZE_MB,
} from '../common/variables.global.js';
import { ImportPreviewDto } from './dto/in/import-preview.dto.js';
import { ImportPlanResponseDto } from './dto/out/import-plan-response.dto.js';
import { ImportsExceptionFilter } from './filter/imports.exception.filter.js';
import { ImportMapper } from './mapper/import.mapper.js';
import type { UploadedImportFile } from './services/import-archive.reader.js';
import { ImportsService } from './services/imports.service.js';

const IMPORT_THROTTLE_LIMIT = 10;
const IMPORT_THROTTLE_TTL_MS = 60000;
const IMPORT_PREVIEW_THROTTLE_LIMIT = 30;

@ApiTags('Imports')
@ApiBearerAuth()
@Controller('imports')
@UseGuards(JwtAuthGuard)
@UseFilters(ImportsExceptionFilter)
@Throttle({
  default: { limit: IMPORT_THROTTLE_LIMIT, ttl: IMPORT_THROTTLE_TTL_MS },
})
@ApiUnauthorizedResponse({
  description: 'Authentification requise.',
  type: ErrorResponseDto,
})
@ApiForbiddenResponse({
  description:
    'Droit page.create_child sur la destination (ou page.create_root pour la racine) requis.',
  type: ErrorResponseDto,
})
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('preview')
  @Throttle({
    default: {
      limit: IMPORT_PREVIEW_THROTTLE_LIMIT,
      ttl: IMPORT_THROTTLE_TTL_MS,
    },
  })
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: IMPORT_MAX_ARCHIVE_SIZE_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: "Calculer l'aperçu d'un import Markdown / Obsidian / NestWiki",
    description:
      "N'écrit rien : lit l'archive (.zip) ou le fichier .md et renvoie l'arbre des pages qui seraient créées, les conflits avec les pages existantes, les médias, les tags et les avertissements.",
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        parentId: {
          type: 'string',
          nullable: true,
          description: 'Page de destination (racine si absent)',
        },
        conflict: {
          type: 'string',
          enum: ['skip', 'rename', 'update'],
          description:
            'Gestion des conflits utilisée pour calculer les chemins',
        },
      },
    },
  })
  @ApiOkResponse({ description: "Plan d'import." })
  @ApiBadRequestResponse({
    description:
      'Fichier absent ou ni .zip ni .md, archive invalide, chemin dangereux dans l’archive, parentId ou conflict invalide.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "La page de destination n'existe pas.",
    type: ErrorResponseDto,
  })
  @ApiPayloadTooLargeResponse({
    description: `Plus de ${IMPORT_MAX_ARCHIVE_SIZE_MB} Mo, de ${IMPORT_MAX_UNCOMPRESSED_SIZE_MB} Mo décompressés ou de ${IMPORT_MAX_PAGES} pages.`,
    type: ErrorResponseDto,
  })
  async preview(
    @UploadedFile() file: UploadedImportFile | undefined,
    @Body() dto: ImportPreviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<ImportPlanResponseDto>> {
    return ImportMapper.toPlanResponse(
      await this.importsService.preview(file, dto, user),
    );
  }
}
