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
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { ResponseDto } from '../common/dto/response.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import type { AuthenticatedUser } from '../common/strategies/jwt.strategy.js';
import { CreateAccessRuleDto } from './dto/in/create-access-rule.dto.js';
import { CreateGroupDto } from './dto/in/create-group.dto.js';
import { SetGlobalPermissionsDto } from './dto/in/set-global-permissions.dto.js';
import { SetMembersDto } from './dto/in/set-members.dto.js';
import { UpdateAccessRuleDto } from './dto/in/update-access-rule.dto.js';
import { UpdateGroupDto } from './dto/in/update-group.dto.js';
import type { AccessRuleResponseDto } from './dto/out/access-rule-response.dto.js';
import type {
  GroupDetailDto,
  GroupSummaryDto,
} from './dto/out/group-response.dto.js';
import { PermissionsExceptionFilter } from './filter/permissions.exception.filter.js';
import { AccessRuleMapper } from './mapper/access-rule.mapper.js';
import { GroupMapper } from './mapper/group.mapper.js';
import { AccessRulesService } from './services/access-rules.service.js';
import { GroupsService } from './services/groups.service.js';

@ApiTags('Admin — Groups')
@ApiBearerAuth()
@Controller('admin/groups')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('user.manage')
@UseFilters(PermissionsExceptionFilter)
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly accessRulesService: AccessRulesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lister les groupes' })
  @ApiOkResponse({
    description: 'Groupes avec nombre de membres et de règles.',
  })
  async list(): Promise<ResponseDto<GroupSummaryDto[]>> {
    const summaries = await this.groupsService.list();
    return GroupMapper.toListResponse(summaries);
  }

  @Post()
  @ApiOperation({ summary: 'Créer un groupe' })
  @ApiBody({ type: CreateGroupDto })
  @ApiOkResponse({ description: 'Groupe créé.' })
  async create(
    @Body() dto: CreateGroupDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<
    ResponseDto<{ id: string; name: string; description: string | null }>
  > {
    const group = await this.groupsService.create(dto, actor.id);
    return GroupMapper.toGroupResponse(group);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un groupe" })
  @ApiParam({ name: 'id', description: 'Identifiant du groupe' })
  @ApiOkResponse({ description: 'Détail du groupe.' })
  async getDetail(
    @Param('id') id: string,
  ): Promise<ResponseDto<GroupDetailDto>> {
    const detail = await this.groupsService.getDetail(id);
    return GroupMapper.toDetailResponse(detail);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un groupe' })
  @ApiParam({ name: 'id', description: 'Identifiant du groupe' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<
    ResponseDto<{ id: string; name: string; description: string | null }>
  > {
    const group = await this.groupsService.update(id, dto, actor.id);
    return GroupMapper.toGroupResponse(group);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un groupe (cascade)' })
  @ApiParam({ name: 'id', description: 'Identifiant du groupe' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.groupsService.delete(id, actor.id);
  }

  @Put(':id/members')
  @ApiOperation({ summary: 'Remplacer la liste des membres du groupe' })
  @ApiParam({ name: 'id', description: 'Identifiant du groupe' })
  async setMembers(
    @Param('id') id: string,
    @Body() dto: SetMembersDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ResponseDto<GroupDetailDto>> {
    await this.groupsService.setMembers(id, dto.userIds, actor.id);
    const detail = await this.groupsService.getDetail(id);
    return GroupMapper.toDetailResponse(detail);
  }

  @Put(':id/permissions')
  @ApiOperation({ summary: 'Remplacer les permissions globales du groupe' })
  @ApiParam({ name: 'id', description: 'Identifiant du groupe' })
  async setPermissions(
    @Param('id') id: string,
    @Body() dto: SetGlobalPermissionsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ResponseDto<GroupDetailDto>> {
    await this.accessRulesService.setGlobalPermissions(
      { type: 'group', id },
      dto.permissions,
      actor.id,
    );
    const detail = await this.groupsService.getDetail(id);
    return GroupMapper.toDetailResponse(detail);
  }

  @Get(':id/access-rules')
  @ApiOperation({ summary: "Lister les règles d'accès directes du groupe" })
  @ApiParam({ name: 'id', description: 'Identifiant du groupe' })
  async listAccessRules(
    @Param('id') id: string,
  ): Promise<ResponseDto<AccessRuleResponseDto[]>> {
    const rules = await this.accessRulesService.listAccessRulesForSubject({
      type: 'group',
      id,
    });
    return AccessRuleMapper.toListResponse(rules);
  }

  @Post(':id/access-rules')
  @ApiOperation({ summary: "Créer une règle d'accès pour le groupe" })
  @ApiParam({ name: 'id', description: 'Identifiant du groupe' })
  async createAccessRule(
    @Param('id') id: string,
    @Body() dto: CreateAccessRuleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ResponseDto<AccessRuleResponseDto>> {
    const rule = await this.accessRulesService.createAccessRule(
      { type: 'group', id },
      dto,
      actor.id,
    );
    return AccessRuleMapper.toResponse(rule);
  }

  @Patch(':id/access-rules/:ruleId')
  @ApiOperation({ summary: "Modifier une règle d'accès du groupe" })
  @ApiParam({ name: 'id', description: 'Identifiant du groupe' })
  @ApiParam({ name: 'ruleId', description: 'Identifiant de la règle' })
  async updateAccessRule(
    @Param('id') id: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateAccessRuleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ResponseDto<AccessRuleResponseDto>> {
    const rule = await this.accessRulesService.updateAccessRule(
      { type: 'group', id },
      ruleId,
      dto,
      actor.id,
    );
    return AccessRuleMapper.toResponse(rule);
  }

  @Delete(':id/access-rules/:ruleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Supprimer une règle d'accès du groupe" })
  @ApiParam({ name: 'id', description: 'Identifiant du groupe' })
  @ApiParam({ name: 'ruleId', description: 'Identifiant de la règle' })
  async deleteAccessRule(
    @Param('id') id: string,
    @Param('ruleId') ruleId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.accessRulesService.deleteAccessRule(
      { type: 'group', id },
      ruleId,
      actor.id,
    );
  }
}
