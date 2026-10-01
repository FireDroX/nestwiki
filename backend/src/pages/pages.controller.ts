import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto.js';
import { ResponseDto } from '../common/dto/response.dto.js';
import { CommentsDisabledException } from '../common/exceptions/pages/comments-disabled.exception.js';
import { PageNotFoundException } from '../common/exceptions/pages/page-not-found.exception.js';
import { VersionNotFoundException } from '../common/exceptions/pages/version-not-found.exception.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard.js';
import type { AuthenticatedUser } from '../common/strategies/jwt.strategy.js';
import { CreateCommentDto } from '../comments/dto/in/create-comment.dto.js';
import { CommentResponseDto } from '../comments/dto/out/comment-response.dto.js';
import { CommentMapper } from '../comments/mapper/comment.mapper.js';
import { CommentsService } from '../comments/services/comments.service.js';
import { PageTagResponseDto } from '../tags/dto/out/page-tag-response.dto.js';
import { TagSummaryDto } from '../tags/dto/out/tag-response.dto.js';
import { TagMapper } from '../tags/mapper/tag.mapper.js';
import { TagsService } from '../tags/services/tags.service.js';
import { DiffVersionsDto } from '../versions/dto/in/diff-versions.dto.js';
import { ListVersionsQueryDto } from '../versions/dto/in/list-versions-query.dto.js';
import { ContributorResponseDto } from '../versions/dto/out/contributor-response.dto.js';
import { DiffResponseDto } from '../versions/dto/out/diff-response.dto.js';
import { VersionDetailResponseDto } from '../versions/dto/out/version-detail-response.dto.js';
import { VersionSummaryResponseDto } from '../versions/dto/out/version-summary-response.dto.js';
import { VersionMapper } from '../versions/mapper/version.mapper.js';
import { VersionsService } from '../versions/services/versions.service.js';
import { ChangeVisibilityDto } from './dto/in/change-visibility.dto.js';
import { CreatePageDto } from './dto/in/create-page.dto.js';
import { DeletePageQueryDto } from './dto/in/delete-page-query.dto.js';
import { MergePreviewDto } from './dto/in/merge-preview.dto.js';
import { MovePageDto } from './dto/in/move-page.dto.js';
import { SetCommentsEnabledDto } from './dto/in/set-comments-enabled.dto.js';
import { UpdatePageDto } from './dto/in/update-page.dto.js';
import { PageDetailResponseDto } from './dto/out/page-detail-response.dto.js';
import { PageMergePreviewResponseDto } from './dto/out/page-merge-preview-response.dto.js';
import { PageResponseDto } from './dto/out/page-response.dto.js';
import { PageTreeNodeDto } from './dto/out/page-tree-node.dto.js';
import { PageUpdateResponseDto } from './dto/out/page-update-response.dto.js';
import { PagesExceptionFilter } from './filter/pages-exception.filter.js';
import { PageMapper } from './mapper/page.mapper.js';
import { PagesService } from './services/pages.service.js';

const COMMENT_CREATE_THROTTLE_LIMIT = 10;
const COMMENT_CREATE_THROTTLE_TTL_MS = 60000;

@ApiTags('Pages')
@Controller('pages')
@UseFilters(PagesExceptionFilter)
export class PagesController {
  constructor(
    private readonly pagesService: PagesService,
    private readonly versionsService: VersionsService,
    private readonly commentsService: CommentsService,
    private readonly tagsService: TagsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer une page' })
  @ApiBody({ type: CreatePageDto })
  @ApiCreatedResponse({ description: 'Page créée avec succès.' })
  @ApiBadRequestResponse({
    description: 'Slug, titre, contenu ou visibilité invalide.',
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
    description: "La page parente indiquée n'existe pas.",
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Un slug identique existe déjà au même niveau.',
    type: ErrorResponseDto,
  })
  async create(
    @Body() dto: CreatePageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<PageResponseDto>> {
    const { page, version } = await this.pagesService.createPage(dto, user.id);
    return PageMapper.toResponse(page, version);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Modifier une page' })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiBody({ type: UpdatePageDto })
  @ApiOkResponse({
    description: 'Page modifiée, une nouvelle version est créée.',
  })
  @ApiBadRequestResponse({
    description: 'Titre, contenu ou résumé de modification invalide.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: "Droit d'édition insuffisant sur cette page.",
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "La page n'existe pas.",
    type: ErrorResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<PageUpdateResponseDto>> {
    const { page, version, conflict, mergedContent } =
      await this.pagesService.updatePage(id, dto, user.id);
    return PageMapper.toUpdateResponse(page, version, conflict, mergedContent);
  }

  @Post(':id/merge-preview')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Prévisualiser une fusion à 3 voies sans sauvegarder',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiBody({ type: MergePreviewDto })
  @ApiOkResponse({
    description:
      "Résultat de la fusion (propre ou en conflit), rien n'est persisté.",
  })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: "Droit d'édition insuffisant sur cette page.",
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "La page ou la version de base n'existe pas.",
    type: ErrorResponseDto,
  })
  async mergePreview(
    @Param('id') id: string,
    @Body() dto: MergePreviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<PageMergePreviewResponseDto>> {
    const result = await this.pagesService.mergePreview(
      id,
      dto.baseVersionId,
      dto.content,
      user.id,
    );
    return PageMapper.toMergePreviewResponse(result);
  }

  @Patch(':id/move')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Déplacer une page dans l'arborescence" })
  @ApiParam({ name: 'id', description: 'Identifiant de la page à déplacer' })
  @ApiBody({ type: MovePageDto })
  @ApiOkResponse({ description: 'Page déplacée avec succès.' })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: "Droit d'édition insuffisant sur cette page.",
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "La page ou la nouvelle page parente n'existe pas.",
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: "Le déplacement créerait un cycle dans l'arborescence.",
    type: ErrorResponseDto,
  })
  async move(
    @Param('id') id: string,
    @Body() dto: MovePageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<PageResponseDto>> {
    const { page, version } = await this.pagesService.movePage(
      id,
      dto,
      user.id,
    );
    return PageMapper.toResponse(page, version);
  }

  @Patch(':id/visibility')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Changer la visibilité d'une page",
    description:
      'La nouvelle visibilité est appliquée en cascade à toutes les pages descendantes. Rendre une page publique déclenche PAGE_PUBLISHED_EVENT.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiBody({ type: ChangeVisibilityDto })
  @ApiOkResponse({
    description: 'Visibilité mise à jour, cascade appliquée aux descendants.',
  })
  @ApiBadRequestResponse({
    description: 'Visibilité invalide.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: "Droit d'édition insuffisant sur cette page.",
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "La page n'existe pas.",
    type: ErrorResponseDto,
  })
  async changeVisibility(
    @Param('id') id: string,
    @Body() dto: ChangeVisibilityDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<PageResponseDto>> {
    const { page, version } = await this.pagesService.setVisibility(
      id,
      dto,
      user.id,
    );
    return PageMapper.toResponse(page, version);
  }

  @Patch(':id/comments-enabled')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Activer ou désactiver les commentaires d'une page",
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiBody({ type: SetCommentsEnabledDto })
  @ApiOkResponse({ description: 'État des commentaires mis à jour.' })
  @ApiBadRequestResponse({
    description: 'commentsEnabled invalide.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: "Droit d'édition insuffisant sur cette page.",
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "La page n'existe pas.",
    type: ErrorResponseDto,
  })
  async setCommentsEnabled(
    @Param('id') id: string,
    @Body() dto: SetCommentsEnabledDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<PageResponseDto>> {
    const { page, version } = await this.pagesService.setCommentsEnabled(
      id,
      dto,
      user.id,
    );
    return PageMapper.toResponse(page, version);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une page' })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiNoContentResponse({ description: 'Page supprimée.' })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: "Droit d'édition insuffisant sur cette page.",
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "La page n'existe pas.",
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'La page a des enfants : relancer avec ?cascade=true.',
    type: ErrorResponseDto,
  })
  @ApiQuery({
    name: 'cascade',
    required: false,
    description: 'Supprimer aussi les pages enfants ("true"/"false").',
  })
  async remove(
    @Param('id') id: string,
    @Query() query: DeletePageQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.pagesService.deletePage(id, query, user.id);
  }

  @Get('tree')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: "Récupérer l'arborescence des pages",
    description:
      'Authentification optionnelle : les pages privées ne sont incluses que si le token correspond à un utilisateur autorisé.',
  })
  @ApiOkResponse({
    description:
      "Arborescence complète, filtrée selon les droits de l'appelant.",
  })
  async getTree(
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<ResponseDto<PageTreeNodeDto[]>> {
    const tree = await this.pagesService.getTree(user);
    return new ResponseDto(tree);
  }

  @Get(':id/versions')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: "Lister l'historique des versions d'une page",
    description:
      'Authentification optionnelle : droits alignés sur la visibilité de la page.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiOkResponse({ description: 'Historique paginé des versions.' })
  @ApiForbiddenResponse({
    description: 'Page privée, accès non autorisé.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "La page n'existe pas.",
    type: ErrorResponseDto,
  })
  async listVersions(
    @Param('id') id: string,
    @Query() query: ListVersionsQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<ResponseDto<PaginatedResponseDto<VersionSummaryResponseDto>>> {
    await this.pagesService.getByIdOrFail(id, user);
    const { items, total, page, limit } =
      await this.versionsService.findAllByPage(id, query);
    return VersionMapper.toPaginatedResponse(items, total, page, limit);
  }

  @Get(':id/versions/contributors')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: "Lister les contributeurs d'une page",
    description:
      'Authentification optionnelle : droits alignés sur la visibilité de la page.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiOkResponse({
    description: 'Liste dédupliquée des contributeurs, plus récent en premier.',
  })
  @ApiForbiddenResponse({
    description: 'Page privée, accès non autorisé.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "La page n'existe pas.",
    type: ErrorResponseDto,
  })
  async listContributors(
    @Param('id') id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<ResponseDto<ContributorResponseDto[]>> {
    await this.pagesService.getByIdOrFail(id, user);
    const contributors = await this.versionsService.getContributors(id);
    return VersionMapper.toContributorsResponse(contributors);
  }

  @Get(':id/versions/:versionId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: "Récupérer une version précise d'une page",
    description:
      'Authentification optionnelle : droits alignés sur la visibilité de la page.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiParam({ name: 'versionId', description: 'Identifiant de la version' })
  @ApiOkResponse({ description: 'Détail de la version demandée.' })
  @ApiForbiddenResponse({
    description: 'Page privée, accès non autorisé.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "La page ou la version n'existe pas.",
    type: ErrorResponseDto,
  })
  async getVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<ResponseDto<VersionDetailResponseDto>> {
    await this.pagesService.getByIdOrFail(id, user);
    const version = await this.versionsService.findOne(id, versionId);
    return VersionMapper.toDetailResponse(version);
  }

  @Post(':id/versions/diff')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Comparer deux versions d'une page",
    description:
      'Authentification optionnelle : droits alignés sur la visibilité de la page.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiBody({ type: DiffVersionsDto })
  @ApiOkResponse({ description: 'Diff ligne à ligne entre les deux versions.' })
  @ApiBadRequestResponse({
    description: 'Identifiants de version manquants ou invalides.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Page privée, accès non autorisé.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "La page ou l'une des versions n'existe pas.",
    type: ErrorResponseDto,
  })
  async diffVersions(
    @Param('id') id: string,
    @Body() dto: DiffVersionsDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<ResponseDto<DiffResponseDto>> {
    await this.pagesService.getByIdOrFail(id, user);
    const diff = await this.versionsService.computeDiff(id, dto.from, dto.to);
    return new ResponseDto(diff);
  }

  @Post(':id/versions/:versionId/restore')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Restaurer une ancienne version',
    description:
      "Crée une nouvelle version à partir du contenu de l'ancienne ; l'historique reste intact.",
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiParam({
    name: 'versionId',
    description: 'Identifiant de la version à restaurer',
  })
  @ApiCreatedResponse({
    description: 'Nouvelle version créée à partir du contenu restauré.',
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
    description: "La page ou la version n'existe pas.",
    type: ErrorResponseDto,
  })
  async restoreVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<PageUpdateResponseDto>> {
    const targetVersion = await this.versionsService.findOne(id, versionId);

    try {
      const { page, version } =
        await this.pagesService.createNewVersionFromContent(
          id,
          targetVersion.content,
          user.id,
          `Restored from version ${versionId}`,
        );
      return PageMapper.toUpdateResponse(page, version);
    } catch (error) {
      if (error instanceof PageNotFoundException) {
        throw new VersionNotFoundException();
      }
      throw error;
    }
  }

  @Get(':id/comments')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: "Lister les commentaires d'une page",
    description:
      'Arbre à un niveau (commentaires puis réponses). Authentification optionnelle : droits alignés sur la visibilité de la page.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiOkResponse({ description: 'Commentaires de la page, triés par date.' })
  @ApiForbiddenResponse({
    description: 'Page privée, accès non autorisé, ou commentaires désactivés.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "La page n'existe pas.",
    type: ErrorResponseDto,
  })
  async listComments(
    @Param('id') id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<ResponseDto<CommentResponseDto[]>> {
    const page = await this.pagesService.getByIdOrFail(id, user);
    if (!page.commentsEnabled) {
      throw new CommentsDisabledException();
    }
    const { comments, authorNames } =
      await this.commentsService.findAllByPage(id);
    return CommentMapper.toTreeResponse(comments, authorNames);
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: COMMENT_CREATE_THROTTLE_LIMIT,
      ttl: COMMENT_CREATE_THROTTLE_TTL_MS,
    },
  })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer un commentaire, ou une réponse via parentId',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiBody({ type: CreateCommentDto })
  @ApiOkResponse({ description: 'Commentaire créé avec succès.' })
  @ApiBadRequestResponse({
    description:
      'Contenu vide, trop long, ou parentId visant une réponse (1 niveau max).',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Commentaires désactivés sur cette page.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "La page ou le commentaire parent n'existe pas.",
    type: ErrorResponseDto,
  })
  async createComment(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<CommentResponseDto>> {
    const page = await this.pagesService.getByIdOrFail(id, user);
    if (!page.commentsEnabled) {
      throw new CommentsDisabledException();
    }
    const { comment, authorNames } = await this.commentsService.createComment(
      id,
      dto,
      user,
    );
    return CommentMapper.toResponse(comment, authorNames);
  }

  @Post(':id/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Suivre une page (idempotent)' })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiNoContentResponse({ description: 'Page suivie.' })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "La page n'existe pas.",
    type: ErrorResponseDto,
  })
  async followPage(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.pagesService.followPage(id, user);
  }

  @Delete(':id/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Ne plus suivre une page (idempotent)' })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiNoContentResponse({ description: 'Page retirée du suivi.' })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  async unfollowPage(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.pagesService.unfollowPage(id, user.id);
  }

  @Get(':id/tags')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "Lister les tags d'une page" })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiOkResponse({ description: 'Tags associés à la page.' })
  @ApiForbiddenResponse({
    description: 'Page privée, accès non autorisé.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "La page n'existe pas.",
    type: ErrorResponseDto,
  })
  async listPageTags(
    @Param('id') id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<ResponseDto<TagSummaryDto[]>> {
    const tags = await this.tagsService.listPageTags(id, user);
    return TagMapper.toListResponse(tags);
  }

  @Post(':id/tags')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Associer un tag à une page' })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiBody({ schema: { properties: { tagId: { type: 'string' } } } })
  @ApiCreatedResponse({ description: 'Association créée.' })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Rôle insuffisant (editor ou admin requis).',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "La page ou le tag n'existe pas.",
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Le tag est déjà associé à cette page.',
    type: ErrorResponseDto,
  })
  async tagPage(
    @Param('id') id: string,
    @Body() dto: { tagId: string },
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<PageTagResponseDto>> {
    const pageTag = await this.tagsService.tagPage(id, dto.tagId, user);
    return TagMapper.toPageTagResponse(pageTag);
  }

  @Delete(':id/tags/:tagId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Retirer un tag d'une page" })
  @ApiParam({ name: 'id', description: 'Identifiant de la page' })
  @ApiParam({ name: 'tagId', description: 'Identifiant du tag' })
  @ApiNoContentResponse({ description: 'Association supprimée.' })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Rôle insuffisant (editor ou admin requis).',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "L'association n'existe pas.",
    type: ErrorResponseDto,
  })
  async untagPage(
    @Param('id') id: string,
    @Param('tagId') tagId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.tagsService.untagPage(id, tagId, user);
  }

  @Get('*path')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Récupérer une page par son chemin',
    description:
      "Authentification optionnelle : droits alignés sur la visibilité de la page. Le chemin est la suite des slugs ancêtres, comme dans l'URL du wiki.",
  })
  @ApiParam({
    name: 'path',
    description:
      'Chemin de la page (slugs séparés par "/"), ex. "documentation/guide-demarrage/installation".',
    type: String,
  })
  @ApiOkResponse({
    description: 'Détail de la page et de sa version courante.',
  })
  @ApiForbiddenResponse({
    description: 'Page privée, accès non autorisé.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Aucune page ne correspond à ce chemin.',
    type: ErrorResponseDto,
  })
  async getByPath(
    @Param('path') path: string[],
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<ResponseDto<PageDetailResponseDto>> {
    const { page, version, isFollowed, canEdit } =
      await this.pagesService.findByPath(path, user);
    return PageMapper.toDetailResponse(page, version, isFollowed, canEdit);
  }
}
