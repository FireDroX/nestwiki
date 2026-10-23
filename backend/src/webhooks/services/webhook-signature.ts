import { createHmac, randomBytes } from 'node:crypto';
import { WEBHOOK_SECRET_PREFIX } from '../../common/variables.global.js';

const SECRET_BYTES = 24;

export class WebhookSignature {
  static sign(secret: string, timestamp: string, body: string): string {
    const digest = createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');
    return `sha256=${digest}`;
  }

  static generateSecret(): string {
    return `${WEBHOOK_SECRET_PREFIX}${randomBytes(SECRET_BYTES).toString('base64url')}`;
  }
}
