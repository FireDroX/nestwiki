import { ArgumentsHost, ForbiddenException } from '@nestjs/common';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import { WebhookDeliveryNotFoundException } from '../../common/exceptions/webhooks/webhook-delivery-not-found.exception.js';
import { WebhookDisabledException } from '../../common/exceptions/webhooks/webhook-disabled.exception.js';
import { WebhookNotFoundException } from '../../common/exceptions/webhooks/webhook-not-found.exception.js';
import { WebhooksExceptionFilter } from './webhooks.exception.filter.js';

function catchWith(exception: Error): {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  const host = {
    switchToHttp: () => ({
      getResponse: () => response as unknown as Response,
    }),
  } as unknown as ArgumentsHost;
  new WebhooksExceptionFilter().catch(exception, host);
  return response;
}

describe('WebhooksExceptionFilter', () => {
  it('answers 404 for an unknown webhook or delivery', () => {
    const response = catchWith(new WebhookNotFoundException());

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ error: 'Webhook not found' });
    expect(
      catchWith(new WebhookDeliveryNotFoundException()).status,
    ).toHaveBeenCalledWith(404);
  });

  it('answers 409 when redelivering for a disabled webhook', () => {
    const response = catchWith(new WebhookDisabledException());

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Webhook is disabled',
    });
  });

  it('answers 400 for a validation error', () => {
    expect(
      catchWith(new ValidationException('name is required')).status,
    ).toHaveBeenCalledWith(400);
  });

  it('forwards guard 403 responses untouched', () => {
    expect(catchWith(new ForbiddenException()).status).toHaveBeenCalledWith(
      403,
    );
  });
});
