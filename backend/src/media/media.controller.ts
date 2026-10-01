import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { ResponseDto } from '../common/dto/response.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import type { AuthenticatedUser } from '../common/strategies/jwt.strategy.js';
import { MAX_ATTACHMENT_SIZE_MB } from '../common/variables.global.js';
import { ListMediaDto } from './dto/in/list-media.dto.js';
import { UploadMediaDto } from './dto/in/upload-media.dto.js';
import { AttachmentResponseDto } from './dto/out/attachment-response.dto.js';
import { MediaLibraryResponseDto } from './dto/out/media-library-response.dto.js';
import { PresignedUrlResponseDto } from './dto/out/presigned-url-response.dto.js';
import { MediaExceptionFilter } from './filter/media-exception.filter.js';
import { AttachmentMapper } from './mapper/attachment.mapper.js';
import { MediaService, UploadedMediaFile } from './services/media.service.js';

@ApiTags('Media')
@Controller('media')
@UseFilters(MediaExceptionFilter)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('media.upload')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Uploader un fichier vers Minio' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        pageId: { type: 'string', nullable: true },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Fichier uploadé avec succès.' })
  @ApiBadRequestResponse({
    description: 'Aucun fichier fourni ou pageId invalide.',
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
  @ApiPayloadTooLargeResponse({
    description: `Fichier de plus de ${MAX_ATTACHMENT_SIZE_MB} Mo.`,
    type: ErrorResponseDto,
  })
  @ApiUnsupportedMediaTypeResponse({
    description: 'Type de fichier non autorisé.',
    type: ErrorResponseDto,
  })
  async upload(
    @UploadedFile() file: UploadedMediaFile | undefined,
    @Body() dto: UploadMediaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<AttachmentResponseDto>> {
    const { attachment, url } = await this.mediaService.uploadFile(
      file,
      dto,
      user.id,
    );
    return AttachmentMapper.toResponse(attachment, url);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      "Lister les médias d'une page, ou parcourir la médiathèque globale",
    description:
      'Avec pageId : médias de cette page (inchangé). Sans pageId : médiathèque globale filtrable (search/type) et paginée (page/limit), visibilité selon le rôle de l’utilisateur.',
  })
  @ApiBody({ type: ListMediaDto })
  @ApiOkResponse({ description: 'Liste des médias.' })
  @ApiUnauthorizedResponse({
    description:
      'Authentification requise pour la médiathèque globale (sans pageId).',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'pageId invalide.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Page privée, accès non autorisé.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "La page n'existe pas.",
    type: ErrorResponseDto,
  })
  async list(
    @Body() dto: ListMediaDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<
    ResponseDto<AttachmentResponseDto[]> | ResponseDto<MediaLibraryResponseDto>
  > {
    if (dto.pageId) {
      const results = await this.mediaService.findAllByPage(dto.pageId, user);
      return AttachmentMapper.toListResponse(results);
    }

    const { items, total } = await this.mediaService.findLibrary(dto, user);
    return AttachmentMapper.toLibraryResponse(items, total);
  }

  @Get(':id/url')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Obtenir une URL présignée pour un média' })
  @ApiOkResponse({ description: 'URL présignée générée.' })
  @ApiBadRequestResponse({
    description: "L'id n'est pas un UUID valide.",
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Page privée, accès non autorisé.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Le média n'existe pas.",
    type: ErrorResponseDto,
  })
  async getUrl(
    @Param('id') id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<ResponseDto<PresignedUrlResponseDto>> {
    const { url, expiresIn } = await this.mediaService.getPresignedUrl(
      id,
      user,
    );
    return AttachmentMapper.toPresignedUrlResponse(url, expiresIn);
  }

  @Get(':id/raw')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Rediriger vers le fichier via une URL présignée fraîche',
    description:
      'URL stable à référencer depuis le contenu Markdown des pages : régénère une URL présignée à chaque appel et redirige (302), donc ne devient jamais invalide contrairement à une URL présignée embarquée telle quelle.',
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'attachment" })
  @ApiBadRequestResponse({
    description: "L'id n'est pas un UUID valide.",
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Page privée, accès non autorisé.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Le média n'existe pas.",
    type: ErrorResponseDto,
  })
  async getRaw(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<void> {
    const { url } = await this.mediaService.getPresignedUrl(id, user);
    res.redirect(url);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('media.delete')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un média' })
  @ApiParam({ name: 'id', description: "Identifiant de l'attachment" })
  @ApiNoContentResponse({ description: 'Média supprimé.' })
  @ApiBadRequestResponse({
    description: "L'id n'est pas un UUID valide.",
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
  @ApiNotFoundResponse({
    description: "Le média n'existe pas.",
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: "Le média est encore référencé par d'autres pages.",
    type: ErrorResponseDto,
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.mediaService.deleteAttachment(id, user.id);
  }
}
