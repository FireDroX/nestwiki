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
import { Roles } from '../common/decorators/roles.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { ResponseDto } from '../common/dto/response.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { AuthenticatedUser } from '../common/strategies/jwt.strategy.js';
import { CreateWebhookDto } from './dto/in/create-webhook.dto.js';
import { ListWebhookDeliveriesQueryDto } from './dto/in/list-webhook-deliveries-query.dto.js';
import { UpdateWebhookDto } from './dto/in/update-webhook.dto.js';
import {
  WebhookDeliveryListResponseDto,
  WebhookDeliveryResponseDto,
} from './dto/out/webhook-delivery-response.dto.js';
import {
  WebhookResponseDto,
  WebhookSummaryResponseDto,
} from './dto/out/webhook-response.dto.js';
import { WebhooksExceptionFilter } from './filter/webhooks.exception.filter.js';
import { WebhookMapper } from './mapper/webhook.mapper.js';
import { WebhooksService } from './services/webhooks.service.js';

@ApiTags('Admin — Webhooks')
@ApiBearerAuth()
@Controller('admin/webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@UseFilters(WebhooksExceptionFilter)
@ApiUnauthorizedResponse({
  description: 'Authentification requise.',
  type: ErrorResponseDto,
})
@ApiForbiddenResponse({
  description: 'Rôle admin requis.',
  type: ErrorResponseDto,
})
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les webhooks sortants' })
  @ApiOkResponse({
    description:
      'Webhooks, avec leur secret de signature et leur dernier envoi.',
  })
  async list(): Promise<ResponseDto<WebhookSummaryResponseDto[]>> {
    return WebhookMapper.toListResponse(await this.webhooksService.list());
  }

  @Post()
  @ApiOperation({
    summary: 'Créer un webhook sortant',
    description:
      'Le secret de signature (whsec_…) est généré. Les adresses du réseau local sont acceptées.',
  })
  @ApiBody({ type: CreateWebhookDto })
  @ApiCreatedResponse({ description: 'Webhook créé.' })
  @ApiBadRequestResponse({
    description: 'Nom, URL, format, événements ou page de portée invalides.',
    type: ErrorResponseDto,
  })
  async create(
    @Body() dto: CreateWebhookDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<WebhookResponseDto>> {
    return WebhookMapper.toResponse(
      await this.webhooksService.create(dto, user.id),
    );
  }

  @Post('deliveries/:deliveryId/redeliver')
  @ApiOperation({
    summary: 'Renvoyer un envoi',
    description:
      'Crée un nouvel envoi avec le même contenu et le tente immédiatement, puis le reprend en cas d’échec. Une copie de webhook.test n’est tentée qu’une fois.',
  })
  @ApiParam({ name: 'deliveryId', description: "Identifiant de l'envoi" })
  @ApiCreatedResponse({ description: 'Nouvel envoi, après la tentative.' })
  @ApiNotFoundResponse({
    description: "L'envoi n'existe pas.",
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Le webhook est désactivé.',
    type: ErrorResponseDto,
  })
  async redeliver(
    @Param('deliveryId') deliveryId: string,
  ): Promise<ResponseDto<WebhookDeliveryResponseDto>> {
    return WebhookMapper.toDeliveryResponse(
      await this.webhooksService.redeliver(deliveryId),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lire un webhook' })
  @ApiParam({ name: 'id', description: 'Identifiant du webhook' })
  @ApiOkResponse({ description: 'Webhook.' })
  @ApiNotFoundResponse({
    description: "Le webhook n'existe pas.",
    type: ErrorResponseDto,
  })
  async get(@Param('id') id: string): Promise<ResponseDto<WebhookResponseDto>> {
    return WebhookMapper.toResponse(await this.webhooksService.get(id));
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modifier un webhook',
    description:
      'Réactiver un webhook désactivé remet à zéro le compteur d’échecs consécutifs.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du webhook' })
  @ApiBody({ type: UpdateWebhookDto })
  @ApiOkResponse({ description: 'Webhook modifié.' })
  @ApiBadRequestResponse({
    description: 'Champ invalide.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Le webhook n'existe pas.",
    type: ErrorResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<WebhookResponseDto>> {
    return WebhookMapper.toResponse(
      await this.webhooksService.update(id, dto, user.id),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un webhook et son historique d’envois' })
  @ApiParam({ name: 'id', description: 'Identifiant du webhook' })
  @ApiNoContentResponse({ description: 'Webhook supprimé.' })
  @ApiNotFoundResponse({
    description: "Le webhook n'existe pas.",
    type: ErrorResponseDto,
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.webhooksService.remove(id, user.id);
  }

  @Post(':id/test')
  @ApiOperation({
    summary: 'Tester un webhook',
    description:
      'Envoie immédiatement l’événement webhook.test, une seule fois, et renvoie le résultat.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant du webhook' })
  @ApiCreatedResponse({ description: 'Résultat de l’envoi.' })
  @ApiNotFoundResponse({
    description: "Le webhook n'existe pas.",
    type: ErrorResponseDto,
  })
  async test(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<WebhookDeliveryResponseDto>> {
    return WebhookMapper.toDeliveryResponse(
      await this.webhooksService.sendTest(id, user.id),
    );
  }

  @Post(':id/rotate-secret')
  @ApiOperation({ summary: 'Régénérer le secret de signature' })
  @ApiParam({ name: 'id', description: 'Identifiant du webhook' })
  @ApiCreatedResponse({ description: 'Webhook avec son nouveau secret.' })
  @ApiNotFoundResponse({
    description: "Le webhook n'existe pas.",
    type: ErrorResponseDto,
  })
  async rotateSecret(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<WebhookResponseDto>> {
    return WebhookMapper.toResponse(
      await this.webhooksService.rotateSecret(id, user.id),
    );
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: "Lister les envois d'un webhook, du plus récent" })
  @ApiParam({ name: 'id', description: 'Identifiant du webhook' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'success', 'failed'],
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({ description: 'Envois paginés.' })
  @ApiBadRequestResponse({
    description: 'Statut inconnu.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Le webhook n'existe pas.",
    type: ErrorResponseDto,
  })
  async listDeliveries(
    @Param('id') id: string,
    @Query() query: ListWebhookDeliveriesQueryDto,
  ): Promise<ResponseDto<WebhookDeliveryListResponseDto>> {
    return WebhookMapper.toDeliveryListResponse(
      await this.webhooksService.listDeliveries(id, query),
    );
  }
}
