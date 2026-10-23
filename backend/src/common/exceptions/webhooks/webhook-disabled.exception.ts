export class WebhookDisabledException extends Error {
  constructor() {
    super('Webhook is disabled');
    this.name = 'WebhookDisabledException';
  }
}
