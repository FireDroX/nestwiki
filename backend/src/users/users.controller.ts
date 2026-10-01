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
  Put,
  Query,
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
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto.js';
import { ResponseDto } from '../common/dto/response.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import type { AuthenticatedUser } from '../common/strategies/jwt.strategy.js';
import { AVATAR_MAX_SIZE_MB } from '../common/variables.global.js';
import { PagesService } from '../pages/services/pages.service.js';
import { CreateAccessRuleDto } from '../permissions/dto/in/create-access-rule.dto.js';
import { SetGlobalPermissionsDto } from '../permissions/dto/in/set-global-permissions.dto.js';
import { UpdateAccessRuleDto } from '../permissions/dto/in/update-access-rule.dto.js';
import type { AccessRuleResponseDto } from '../permissions/dto/out/access-rule-response.dto.js';
import { AccessRuleMapper } from '../permissions/mapper/access-rule.mapper.js';
import { AccessRulesService } from '../permissions/services/access-rules.service.js';
import {
  PermissionsService,
  type UserEffectivePermissions,
} from '../permissions/services/permissions.service.js';
import { AdminUpdateUserDto } from './dto/in/admin-update-user.dto.js';
import { CreateAdminUserDto } from './dto/in/create-admin-user.dto.js';
import { ListMyActivityQueryDto } from './dto/in/list-my-activity-query.dto.js';
import { ListUsersQueryDto } from './dto/in/list-users-query.dto.js';
import { SetUserGroupsDto } from './dto/in/set-user-groups.dto.js';
import { SetUserStatusDto } from './dto/in/set-user-status.dto.js';
import { UpdateProfileDto } from './dto/in/update-profile.dto.js';
import { AdminCreateUserResponseDto } from './dto/out/admin-create-user-response.dto.js';
import { AdminUserDetailResponseDto } from './dto/out/admin-user-detail-response.dto.js';
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

  @Get(':id/avatar')
  @ApiOperation({
    summary:
      "Rediriger vers la photo de profil d'un utilisateur via une URL présignée fraîche",
    description:
      'URL stable à référencer comme src d’image : régénère une URL présignée à chaque appel et redirige (302), donc ne devient jamais invalide contrairement à une URL présignée embarquée telle quelle.',
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiNotFoundResponse({
    description: "L'utilisateur n'existe pas ou n'a pas de photo de profil.",
    type: ErrorResponseDto,
  })
  async getAvatar(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.usersService.getAvatarRedirectUrl(id);
    res.redirect(url);
  }
}

@ApiTags('Admin — Users')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('user.manage')
@UseFilters(UsersExceptionFilter)
export class AdminUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly accessRulesService: AccessRulesService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lister les utilisateurs' })
  @ApiOkResponse({ description: 'Liste paginée des utilisateurs.' })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Permission user.manage requise.',
    type: ErrorResponseDto,
  })
  async listUsers(
    @Query() query: ListUsersQueryDto,
  ): Promise<ResponseDto<PaginatedResponseDto<UserResponseDto>>> {
    const page = await this.usersService.findAllFilteredPaginated(query);
    return UserMapper.toAdminPaginatedResponse(page);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer un utilisateur' })
  @ApiBody({ type: CreateAdminUserDto })
  @ApiOkResponse({
    description:
      'Utilisateur créé. Si aucun mot de passe fourni, un mot de passe temporaire est renvoyé une seule fois.',
  })
  @ApiBadRequestResponse({
    description: 'Email, nom, rôle ou mot de passe invalide.',
    type: ErrorResponseDto,
  })
  async createUser(
    @Body() dto: CreateAdminUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ResponseDto<AdminCreateUserResponseDto>> {
    const result = await this.usersService.createByAdmin(actor, dto);
    if (dto.permissions && dto.permissions.length > 0) {
      await this.accessRulesService.setGlobalPermissions(
        { type: 'user', id: result.user.id },
        dto.permissions,
        actor.id,
      );
    }
    return UserMapper.toAdminCreateResponse(result);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un utilisateur" })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiNotFoundResponse({
    description: "L'utilisateur n'existe pas.",
    type: ErrorResponseDto,
  })
  async getDetail(
    @Param('id') id: string,
  ): Promise<ResponseDto<AdminUserDetailResponseDto>> {
    const detail = await this.usersService.getAdminDetail(id);
    return UserMapper.toAdminDetailResponse(detail);
  }

  @Patch(':id')
  @ApiOperation({
    summary: "Modifier les infos ou le rôle d'un utilisateur",
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiBody({ type: AdminUpdateUserDto })
  @ApiOkResponse({ description: 'Utilisateur mis à jour.' })
  @ApiBadRequestResponse({
    description: 'Email, nom ou rôle invalide.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "L'utilisateur n'existe pas.",
    type: ErrorResponseDto,
  })
  async updateUser(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ResponseDto<UserResponseDto>> {
    const entity = await this.usersService.adminUpdate(actor, id, dto);
    return UserMapper.toResponse(entity);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Activer ou désactiver un utilisateur' })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiBody({ type: SetUserStatusDto })
  @ApiOkResponse({ description: 'Statut mis à jour.' })
  @ApiNotFoundResponse({
    description: "L'utilisateur n'existe pas.",
    type: ErrorResponseDto,
  })
  async setStatus(
    @Param('id') id: string,
    @Body() dto: SetUserStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ResponseDto<UserResponseDto>> {
    const entity = await this.usersService.setStatus(actor, id, dto.isActive);
    return UserMapper.toResponse(entity);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Réinitialiser le mot de passe' })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiOkResponse({
    description: 'Mot de passe temporaire généré, renvoyé une seule fois.',
  })
  @ApiNotFoundResponse({
    description: "L'utilisateur n'existe pas.",
    type: ErrorResponseDto,
  })
  async resetPassword(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ResponseDto<{ temporaryPassword: string }>> {
    const temporaryPassword = await this.usersService.resetPassword(actor, id);
    return new ResponseDto({ temporaryPassword });
  }

  @Post(':id/unlock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Déverrouiller un compte' })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiOkResponse({ description: 'Compte déverrouillé.' })
  @ApiNotFoundResponse({
    description: "L'utilisateur n'existe pas.",
    type: ErrorResponseDto,
  })
  async unlock(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ResponseDto<UserResponseDto>> {
    const entity = await this.usersService.unlock(actor, id);
    return UserMapper.toResponse(entity);
  }

  @Put(':id/groups')
  @ApiOperation({ summary: "Remplacer les groupes de l'utilisateur" })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiBody({ type: SetUserGroupsDto })
  @ApiOkResponse({ description: 'Groupes mis à jour.' })
  async setGroups(
    @Param('id') id: string,
    @Body() dto: SetUserGroupsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ResponseDto<AdminUserDetailResponseDto>> {
    await this.usersService.setGroups(actor, id, dto.groupIds);
    const detail = await this.usersService.getAdminDetail(id);
    return UserMapper.toAdminDetailResponse(detail);
  }

  @Get(':id/effective-permissions')
  @ApiOperation({
    summary:
      "Permissions globales et règles d'accès cumulées de l'utilisateur, avec leur origine",
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  async getEffectivePermissions(
    @Param('id') id: string,
  ): Promise<ResponseDto<UserEffectivePermissions>> {
    const user = await this.usersService.findById(id);
    const explanation =
      await this.permissionsService.explainUserPermissions(user);
    return new ResponseDto(explanation);
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
    description: 'Permission user.manage requise.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "L'utilisateur n'existe pas.",
    type: ErrorResponseDto,
  })
  async deleteUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.usersService.deleteUser(actor, id);
  }

  @Put(':id/permissions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Remplacer les permissions globales directes de l'utilisateur",
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  async setPermissions(
    @Param('id') id: string,
    @Body() dto: SetGlobalPermissionsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.accessRulesService.setGlobalPermissions(
      { type: 'user', id },
      dto.permissions,
      actor.id,
    );
  }

  @Get(':id/access-rules')
  @ApiOperation({
    summary: "Lister les règles d'accès directes de l'utilisateur",
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  async listAccessRules(
    @Param('id') id: string,
  ): Promise<ResponseDto<AccessRuleResponseDto[]>> {
    const rules = await this.accessRulesService.listAccessRulesForSubject({
      type: 'user',
      id,
    });
    return AccessRuleMapper.toListResponse(rules);
  }

  @Post(':id/access-rules')
  @ApiOperation({
    summary: "Créer une règle d'accès directe pour l'utilisateur",
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  async createAccessRule(
    @Param('id') id: string,
    @Body() dto: CreateAccessRuleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ResponseDto<AccessRuleResponseDto>> {
    const rule = await this.accessRulesService.createAccessRule(
      { type: 'user', id },
      dto,
      actor.id,
    );
    return AccessRuleMapper.toResponse(rule);
  }

  @Patch(':id/access-rules/:ruleId')
  @ApiOperation({
    summary: "Modifier une règle d'accès directe de l'utilisateur",
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiParam({ name: 'ruleId', description: 'Identifiant de la règle' })
  async updateAccessRule(
    @Param('id') id: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateAccessRuleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ResponseDto<AccessRuleResponseDto>> {
    const rule = await this.accessRulesService.updateAccessRule(
      { type: 'user', id },
      ruleId,
      dto,
      actor.id,
    );
    return AccessRuleMapper.toResponse(rule);
  }

  @Delete(':id/access-rules/:ruleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Supprimer une règle d'accès directe de l'utilisateur",
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiParam({ name: 'ruleId', description: 'Identifiant de la règle' })
  async deleteAccessRule(
    @Param('id') id: string,
    @Param('ruleId') ruleId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.accessRulesService.deleteAccessRule(
      { type: 'user', id },
      ruleId,
      actor.id,
    );
  }
}
