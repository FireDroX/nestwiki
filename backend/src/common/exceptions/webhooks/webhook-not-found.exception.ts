export class WebhookNotFoundException extends Error {
  constructor() {
    super('Webhook not found');
    this.name = 'WebhookNotFoundException';
  }
}
