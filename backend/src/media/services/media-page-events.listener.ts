import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  PAGE_CREATED_EVENT,
  PageCreatedEvent,
} from '../../pages/events/page-created.event.js';
import {
  PAGE_VERSION_CREATED_EVENT,
  PageVersionCreatedEvent,
} from '../../pages/events/page-version-created.event.js';
import {
  PAGES_PURGED_EVENT,
  PagesPurgedEvent,
} from '../../pages/events/pages-purged.event.js';
import { MediaService } from './media.service.js';

@Injectable()
export class MediaPageEventsListener {
  private readonly logger = new Logger(MediaPageEventsListener.name);

  constructor(private readonly mediaService: MediaService) {}

  @OnEvent(PAGE_CREATED_EVENT, { async: true })
  onPageCreated(event: PageCreatedEvent): Promise<void> {
    return this.safely(() =>
      this.mediaService.attachUploadsReferencedBy(
        event.pageId,
        event.content,
        event.actorId,
      ),
    );
  }

  @OnEvent(PAGE_VERSION_CREATED_EVENT, { async: true })
  onPageVersionCreated(event: PageVersionCreatedEvent): Promise<void> {
    return this.safely(() =>
      this.mediaService.attachUploadsReferencedBy(
        event.pageId,
        event.content,
        event.authorId,
      ),
    );
  }

  @OnEvent(PAGES_PURGED_EVENT, { async: true })
  onPagesPurged(event: PagesPurgedEvent): Promise<void> {
    return this.safely(() =>
      this.mediaService.releaseDetachedAttachments(event.detachedAttachmentIds),
    );
  }

  private async safely(task: () => Promise<void>): Promise<void> {
    try {
      await task();
    } catch (error) {
      this.logger.error(`Media bookkeeping failed: ${String(error)}`);
    }
  }
}
