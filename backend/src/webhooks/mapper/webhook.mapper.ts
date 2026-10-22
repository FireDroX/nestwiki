import { ResponseDto } from '../../common/dto/response.dto.js';
import {
  WebhookDeliveryListResponseDto,
  WebhookDeliveryResponseDto,
} from '../dto/out/webhook-delivery-response.dto.js';
import {
  WebhookResponseDto,
  WebhookSummaryResponseDto,
} from '../dto/out/webhook-response.dto.js';
import { WebhookDelivery } from '../entities/webhook-delivery.entity.js';
import { Webhook } from '../entities/webhook.entity.js';
import type { WebhookWithLastDelivery } from '../services/webhooks.service.js';

export class WebhookMapper {
  static toResponseDto(webhook: Webhook): WebhookResponseDto {
    return {
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      format: webhook.format,
      events: webhook.events,
      secret: webhook.secret,
      enabled: webhook.enabled,
      includePrivatePages: webhook.includePrivatePages,
      scopePageId: webhook.scopePageId,
      consecutiveFailures: webhook.consecutiveFailures,
      disabledReason: webhook.disabledReason,
      createdById: webhook.createdById,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    };
  }

  static toResponse(webhook: Webhook): ResponseDto<WebhookResponseDto> {
    return new ResponseDto(WebhookMapper.toResponseDto(webhook));
  }

  static toListResponse(
    items: WebhookWithLastDelivery[],
  ): ResponseDto<WebhookSummaryResponseDto[]> {
    return new ResponseDto(
      items.map(({ webhook, lastDelivery }) => ({
        ...WebhookMapper.toResponseDto(webhook),
        lastDelivery: lastDelivery
          ? {
              createdAt: lastDelivery.createdAt,
              status: lastDelivery.status,
              lastStatusCode: lastDelivery.lastStatusCode,
            }
          : null,
      })),
    );
  }

  static toDeliveryDto(delivery: WebhookDelivery): WebhookDeliveryResponseDto {
    return {
      id: delivery.id,
      webhookId: delivery.webhookId,
      event: delivery.event,
      payload: delivery.payload,
      status: delivery.status,
      attempts: delivery.attempts,
      nextAttemptAt: delivery.nextAttemptAt,
      lastStatusCode: delivery.lastStatusCode,
      lastError: delivery.lastError,
      durationMs: delivery.durationMs,
      createdAt: delivery.createdAt,
      deliveredAt: delivery.deliveredAt,
    };
  }

  static toDeliveryResponse(
    delivery: WebhookDelivery,
  ): ResponseDto<WebhookDeliveryResponseDto> {
    return new ResponseDto(WebhookMapper.toDeliveryDto(delivery));
  }

  static toDeliveryListResponse(list: {
    items: WebhookDelivery[];
    total: number;
  }): ResponseDto<WebhookDeliveryListResponseDto> {
    return new ResponseDto({
      items: list.items.map((delivery) =>
        WebhookMapper.toDeliveryDto(delivery),
      ),
      total: list.total,
    });
  }
}
