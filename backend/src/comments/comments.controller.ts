import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto.js';
import { ResponseDto } from '../common/dto/response.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import type { AuthenticatedUser } from '../common/strategies/jwt.strategy.js';
import { ListUserCommentsQueryDto } from './dto/in/list-user-comments-query.dto.js';
import { PurgeCommentsDto } from './dto/in/purge-comments.dto.js';
import { UpdateCommentDto } from './dto/in/update-comment.dto.js';
import { CommentResponseDto } from './dto/out/comment-response.dto.js';
import { UserCommentResponseDto } from './dto/out/user-comment-response.dto.js';
import { CommentsExceptionFilter } from './filter/comments-exception.filter.js';
import { CommentMapper } from './mapper/comment.mapper.js';
import { CommentsService } from './services/comments.service.js';

@ApiTags('Comments')
@Controller('comments')
@UseFilters(CommentsExceptionFilter)
export class CommentController {
  constructor(private readonly commentsService: CommentsService) {}

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Modifier son propre commentaire' })
  @ApiParam({ name: 'id', description: 'Identifiant du commentaire' })
  @ApiBody({ type: UpdateCommentDto })
  @ApiOkResponse({ description: 'Commentaire modifié.' })
  @ApiBadRequestResponse({
    description: 'Contenu vide ou trop long.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: "Seul l'auteur peut éditer son commentaire.",
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Le commentaire n'existe pas.",
    type: ErrorResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<CommentResponseDto>> {
    const { comment, authorNames } = await this.commentsService.updateComment(
      id,
      dto,
      user,
    );
    return CommentMapper.toResponse(comment, authorNames);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer un commentaire',
    description:
      'Auteur : suppression douce (contenu vidé, réponses intactes). Éditeur/admin non-auteur : suppression définitive, cascade sur les réponses.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du commentaire' })
  @ApiNoContentResponse({ description: 'Commentaire supprimé.' })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Ni auteur, ni éditeur, ni admin.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Le commentaire n'existe pas.",
    type: ErrorResponseDto,
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commentsService.deleteComment(id, user);
  }
}

@ApiTags('Admin — Comments')
@ApiBearerAuth()
@Controller('admin/users/:id/comments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('user.manage')
@UseFilters(CommentsExceptionFilter)
export class AdminUserCommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @ApiOperation({
    summary: "Lister tous les commentaires d'un utilisateur (modération)",
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiOkResponse({ description: 'Commentaires paginés de cet utilisateur.' })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Permission user.manage requise.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "L'utilisateur n'existe pas.",
    type: ErrorResponseDto,
  })
  async list(
    @Param('id') userId: string,
    @Query() query: ListUserCommentsQueryDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<ResponseDto<PaginatedResponseDto<UserCommentResponseDto>>> {
    const { items, total, page, limit } = await this.commentsService.listByUser(
      userId,
      query,
      admin,
    );
    return CommentMapper.toPaginatedUserComments(items, total, page, limit);
  }

  @Delete()
  @ApiOperation({
    summary: "Purger les commentaires d'un utilisateur",
    description:
      "Sans body : purge tous les commentaires de l'utilisateur. Avec commentIds : purge seulement la sélection. Cascade sur les réponses.",
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiBody({ type: PurgeCommentsDto, required: false })
  @ApiOkResponse({ description: 'Nombre de commentaires purgés.' })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Permission user.manage requise.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "L'utilisateur n'existe pas.",
    type: ErrorResponseDto,
  })
  async purge(
    @Param('id') userId: string,
    @Body() dto: PurgeCommentsDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<ResponseDto<{ purgedCount: number }>> {
    const purgedCount = await this.commentsService.purgeByUser(
      userId,
      dto ?? {},
      admin,
    );
    return new ResponseDto({ purgedCount });
  }
}
