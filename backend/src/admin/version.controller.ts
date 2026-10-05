import { Controller, Get, UseFilters, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { ResponseDto } from '../common/dto/response.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { VersionStatusResponseDto } from './dto/out/version-status-response.dto.js';
import { AdminExceptionFilter } from './filter/admin.exception.filter.js';
import { VersionMapper } from './mapper/version.mapper.js';
import { VersionCheckService } from './services/version-check.service.js';

@ApiTags('Admin — Version')
@ApiBearerAuth()
@Controller('admin/version')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@UseFilters(AdminExceptionFilter)
export class AdminVersionController {
  constructor(private readonly versionCheckService: VersionCheckService) {}

  @Get()
  @ApiOperation({
    summary: 'Version installée et dernière release publiée sur GitHub',
    description:
      'La dernière release est mise en cache 6 h ; sans réponse de GitHub (ou avec UPDATE_CHECK=false), latestVersion vaut null et updateAvailable false.',
  })
  @ApiOkResponse({ description: 'État de la version.' })
  @ApiUnauthorizedResponse({
    description: 'Authentification requise.',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Rôle admin requis.',
    type: ErrorResponseDto,
  })
  async getStatus(): Promise<ResponseDto<VersionStatusResponseDto>> {
    return VersionMapper.toResponse(await this.versionCheckService.getStatus());
  }
}
