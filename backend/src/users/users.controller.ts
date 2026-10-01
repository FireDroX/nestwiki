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
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserActivityLogService } from '../activity/services/user-activity-log.service.js';
import { UserActivityLogListDto } from '../activity/dto/out/user-activity-log-response.dto.js';
import { UserActivityLogMapper } from '../activity/mapper/user-activity-log.mapper.js';
import { ListUserCommentsQueryDto } from '../comments/dto/in/list-user-comments-query.dto.js';
import { UserCommentResponseDto } from '../comments/dto/out/user-comment-response.dto.js';
import { CommentMapper } from '../comments/mapper/comment.mapper.js';
import { CommentsService } from '../comments/services/comments.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto.js';
import { ResponseDto } from '../common/dto/response.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { AuthenticatedUser } from '../common/strategies/jwt.strategy.js';
import { AVATAR_MAX_SIZE_MB } from '../common/variables.global.js';
import { PagesService } from '../pages/services/pages.service.js';
import { PermissionsService } from '../permissions/services/permissions.service.js';
import { ListMyActivityQueryDto } from './dto/in/list-my-activity-query.dto.js';
import { ListUsersQueryDto } from './dto/in/list-users-query.dto.js';
import { UpdateProfileDto } from './dto/in/update-profile.dto.js';
import { UpdateRoleDto } from './dto/in/update-role.dto.js';
import { UserResponseDto } from './dto/out/user-response.dto.js';
import { UsersExceptionFilter } from './filter/users-exception.filter.js';
import { UserMapper } from './mapper/user.mapper.js';
import { UploadedAvatarFile, UsersService } from './services/users.service.js';

@ApiTags('Users')
@Controller('users')
@UseFilters(UsersExceptionFilter)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly commentsService: CommentsService,
    private readonly pagesService: PagesService,
    private readonly userActivityLogService: UserActivityLogService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer mon profil' })
  @ApiOkResponse({ description: "Profil de l'utilisateur connecté." })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  async getMe(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<UserResponseDto>> {
    const entity = await this.usersService.findById(user.id);
    const [
      commentsCount,
      pagesCreatedCount,
      pageEditsCount,
      permissions,
      groups,
    ] = await Promise.all([
      this.commentsService.countByAuthorId(user.id),
      this.pagesService.countCreatedByUser(user.id),
      this.pagesService.countVersionsByAuthor(user.id),
      this.permissionsService.getEffectiveGlobalPermissions(entity),
      this.permissionsService.getGroupsForUser(entity),
    ]);
    return UserMapper.toMeResponse(
      entity,
      { commentsCount, pagesCreatedCount, pageEditsCount },
      permissions,
      groups,
    );
  }

  @Get('me/activity')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister mon activité récente' })
  @ApiOkResponse({ description: 'Activité paginée, plus récente en premier.' })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  async listMyActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMyActivityQueryDto,
  ): Promise<ResponseDto<UserActivityLogListDto>> {
    const { items, total } = await this.userActivityLogService.list({
      ...query,
      userId: user.id,
    });
    return UserActivityLogMapper.toListResponse(items, total);
  }

  @Get('me/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Lister les commentaires que j'ai écrits" })
  @ApiOkResponse({
    description: 'Commentaires paginés, plus récents en premier.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  async listMyComments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListUserCommentsQueryDto,
  ): Promise<ResponseDto<PaginatedResponseDto<UserCommentResponseDto>>> {
    const { items, total, page, limit } = await this.commentsService.listByUser(
      user.id,
      query,
      user,
      true,
    );
    return CommentMapper.toPaginatedUserComments(items, total, page, limit);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Modifier mon profil' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiOkResponse({ description: 'Profil mis à jour.' })
  @ApiBadRequestResponse({
    description: "Nom d'affichage invalide.",
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ResponseDto<UserResponseDto>> {
    const entity = await this.usersService.updateProfile(user.id, dto);
    return UserMapper.toResponse(entity);
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Uploader ma photo de profil' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ description: 'Avatar mis à jour.' })
  @ApiBadRequestResponse({
    description: `Aucun fichier fourni, type non supporté, ou fichier de plus de ${AVATAR_MAX_SIZE_MB}Mo.`,
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  async uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedAvatarFile | undefined,
  ): Promise<ResponseDto<UserResponseDto>> {
    const entity = await this.usersService.uploadAvatar(user.id, file);
    return UserMapper.toResponse(entity);
  }

  @Delete('me/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retirer ma photo de profil' })
  @ApiOkResponse({ description: 'Avatar retiré.' })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  async removeAvatar(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<UserResponseDto>> {
    const entity = await this.usersService.removeAvatar(user.id);
    return UserMapper.toResponse(entity);
  }
}

@ApiTags('Admin — Users')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@UseFilters(UsersExceptionFilter)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les utilisateurs' })
  @ApiOkResponse({ description: 'Liste paginée des utilisateurs.' })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Rôle admin requis.',
    type: ErrorResponseDto,
  })
  async listUsers(
    @Query() query: ListUsersQueryDto,
  ): Promise<ResponseDto<PaginatedResponseDto<UserResponseDto>>> {
    const { items, total, page, limit } =
      await this.usersService.findAllPaginated(query);
    return UserMapper.toPaginatedResponse(items, total, page, limit);
  }

  @Patch(':id/role')
  @ApiOperation({ summary: "Modifier le rôle d'un utilisateur" })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiBody({ type: UpdateRoleDto })
  @ApiOkResponse({ description: 'Rôle mis à jour.' })
  @ApiBadRequestResponse({
    description: 'Rôle invalide.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Rôle admin requis.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "L'utilisateur n'existe pas.",
    type: ErrorResponseDto,
  })
  async updateRole(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<ResponseDto<UserResponseDto>> {
    const entity = await this.usersService.updateRole(admin.id, id, dto);
    return UserMapper.toResponse(entity);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un utilisateur' })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiNoContentResponse({ description: 'Utilisateur supprimé.' })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Rôle admin requis.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "L'utilisateur n'existe pas.",
    type: ErrorResponseDto,
  })
  async deleteUser(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.usersService.deleteUser(admin.id, id);
  }
}
