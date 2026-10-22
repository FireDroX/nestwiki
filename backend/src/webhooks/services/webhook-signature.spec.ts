import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { WebhookSignature } from './webhook-signature.js';

describe('WebhookSignature', () => {
  it('signs the timestamp and the body with the secret so a receiver can check it', () => {
    const body = '{"event":"page.created"}';
    const signature = WebhookSignature.sign('whsec_abc', '1792600000', body);

    const expected = createHmac('sha256', 'whsec_abc')
      .update(`1792600000.${body}`)
      .digest('hex');
    expect(signature).toBe(`sha256=${expected}`);
  });

  it('changes when the body is altered', () => {
    expect(WebhookSignature.sign('s', '1', 'a')).not.toBe(
      WebhookSignature.sign('s', '1', 'b'),
    );
  });

  it('generates distinct prefixed secrets', () => {
    const first = WebhookSignature.generateSecret();

    expect(first).toMatch(/^whsec_[A-Za-z0-9_-]{32}$/);
    expect(WebhookSignature.generateSecret()).not.toBe(first);
  });
});
