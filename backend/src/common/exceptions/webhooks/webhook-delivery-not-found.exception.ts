export class WebhookDeliveryNotFoundException extends Error {
  constructor() {
    super('Webhook delivery not found');
    this.name = 'WebhookDeliveryNotFoundException';
  }
}
