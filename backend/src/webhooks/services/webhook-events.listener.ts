import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  COMMENT_CREATED_EVENT,
  CommentCreatedEvent,
} from '../../comments/events/comment-created.event.js';
import {
  PAGE_CREATED_EVENT,
  PageCreatedEvent,
} from '../../pages/events/page-created.event.js';
import {
  PAGE_MOVED_EVENT,
  PageMovedEvent,
} from '../../pages/events/page-moved.event.js';
import {
  PAGE_PUBLISHED_EVENT,
  PagePublishedEvent,
} from '../../pages/events/page-published.event.js';
import {
  PAGE_RESTORED_EVENT,
  PageRestoredEvent,
} from '../../pages/events/page-restored.event.js';
import {
  PAGE_TRASHED_EVENT,
  PageTrashedEvent,
} from '../../pages/events/page-trashed.event.js';
import {
  PAGE_VERSION_CREATED_EVENT,
  PageVersionCreatedEvent,
} from '../../pages/events/page-version-created.event.js';
import {
  PAGES_IMPORTED_EVENT,
  PagesImportedEvent,
} from '../../pages/events/pages-imported.event.js';
import { PageReferenceService } from '../../pages/services/page-reference.service.js';
import type { WebhookEventName } from '../entities/webhook.entity.js';
import {
  WebhookDeliveryService,
  type PublishedEvent,
} from './webhook-delivery.service.js';

@Injectable()
export class WebhookEventsListener {
  private readonly logger = new Logger(WebhookEventsListener.name);

  constructor(
    private readonly deliveryService: WebhookDeliveryService,
    private readonly pageReferenceService: PageReferenceService,
  ) {}

  @OnEvent(PAGE_CREATED_EVENT, { async: true })
  onPageCreated(event: PageCreatedEvent): Promise<void> {
    return this.publishForPage('page.created', event.pageId, event.actorId, {});
  }

  @OnEvent(PAGE_VERSION_CREATED_EVENT, { async: true })
  onPageVersionCreated(event: PageVersionCreatedEvent): Promise<void> {
    return this.whenSubscribed('page.updated', async () => {
      const page = await this.pageReferenceService.describe(event.pageId);
      if (page && !page.inTrash) {
        await this.deliveryService.publish('page.updated', {
          actorId: event.authorId,
          page,
          data: {
            versionId: event.versionId,
            changeSummary: event.changeSummary,
          },
        });
      }
    });
  }

  @OnEvent(PAGE_MOVED_EVENT, { async: true })
  onPageMoved(event: PageMovedEvent): Promise<void> {
    return this.publishForPage('page.moved', event.pageId, event.actorId, {
      fromPath: event.fromPath,
      toPath: event.toPath,
    });
  }

  @OnEvent(PAGE_TRASHED_EVENT, { async: true })
  onPageTrashed(event: PageTrashedEvent): Promise<void> {
    return this.publishForPage('page.deleted', event.pageId, event.actorId, {
      descendantCount: event.descendantCount,
    });
  }

  @OnEvent(PAGE_RESTORED_EVENT, { async: true })
  onPageRestored(event: PageRestoredEvent): Promise<void> {
    return this.publishForPage(
      'page.restored',
      event.pageId,
      event.actorId,
      {},
    );
  }

  @OnEvent(PAGE_PUBLISHED_EVENT, { async: true })
  onPagePublished(event: PagePublishedEvent): Promise<void> {
    return this.publishForPage(
      'page.published',
      event.pageId,
      event.actorId,
      {},
    );
  }

  @OnEvent(COMMENT_CREATED_EVENT, { async: true })
  onCommentCreated(event: CommentCreatedEvent): Promise<void> {
    return this.publishForPage(
      'comment.created',
      event.pageId,
      event.authorId,
      {
        commentId: event.commentId,
      },
    );
  }

  @OnEvent(PAGES_IMPORTED_EVENT, { async: true })
  async onPagesImported(event: PagesImportedEvent): Promise<void> {
    await this.whenSubscribed('pages.imported', async () => {
      const page = event.rootPageId
        ? await this.pageReferenceService.describe(event.rootPageId)
        : null;
      await this.deliveryService.publish('pages.imported', {
        actorId: event.actorId,
        page,
        data: {
          pageCount: event.createdCount + event.updatedCount,
          createdCount: event.createdCount,
          updatedCount: event.updatedCount,
        },
      });
    });
  }

  private publishForPage(
    event: WebhookEventName,
    pageId: string,
    actorId: string,
    data: PublishedEvent['data'],
  ): Promise<void> {
    return this.whenSubscribed(event, async () => {
      const page = await this.pageReferenceService.describe(pageId);
      if (page) {
        await this.deliveryService.publish(event, { actorId, page, data });
      }
    });
  }

  private async whenSubscribed(
    event: WebhookEventName,
    work: () => Promise<void>,
  ): Promise<void> {
    try {
      if (await this.deliveryService.hasSubscribers(event)) {
        await work();
      }
    } catch (error) {
      this.logger.error(`Webhook event not queued: ${String(error)}`);
    }
  }
}
