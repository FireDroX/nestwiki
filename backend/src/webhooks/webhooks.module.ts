import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from '../admin/admin.module.js';
import { PagesModule } from '../pages/pages.module.js';
import { UsersModule } from '../users/users.module.js';
import { WebhookDelivery } from './entities/webhook-delivery.entity.js';
import { Webhook } from './entities/webhook.entity.js';
import { TypeormWebhookDeliveryRepository } from './persistence/typeorm.webhook-delivery.repository.js';
import { TypeormWebhookRepository } from './persistence/typeorm.webhook.repository.js';
import { WebhookDeliveryService } from './services/webhook-delivery.service.js';
import { WebhookEventsListener } from './services/webhook-events.listener.js';
import { WebhookHttpClient } from './services/webhook-http.client.js';
import { WebhooksService } from './services/webhooks.service.js';
import { WebhooksController } from './webhooks.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Webhook, WebhookDelivery]),
    AdminModule,
    PagesModule,
    UsersModule,
  ],
  controllers: [WebhooksController],
  providers: [
    { provide: 'WebhooksRepository', useClass: TypeormWebhookRepository },
    {
      provide: 'WebhookDeliveriesRepository',
      useClass: TypeormWebhookDeliveryRepository,
    },
    WebhookHttpClient,
    WebhookDeliveryService,
    WebhookEventsListener,
    WebhooksService,
  ],
})
export class WebhooksModule {}
