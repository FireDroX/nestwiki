import { Injectable } from '@nestjs/common';
import { WEBHOOK_TIMEOUT_MS } from '../../common/variables.global.js';

@Injectable()
export class WebhookHttpClient {
  async post(
    url: string,
    headers: Record<string, string>,
    body: string,
  ): Promise<number> {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    await response.body?.cancel();
    return response.status;
  }
}
