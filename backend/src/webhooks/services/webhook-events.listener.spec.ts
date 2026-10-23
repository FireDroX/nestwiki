import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { CommentCreatedEvent } from '../../comments/events/comment-created.event.js';
import type { PageReferenceDto } from '../../pages/dto/out/page-reference.dto.js';
import { PageCreatedEvent } from '../../pages/events/page-created.event.js';
import { PageMovedEvent } from '../../pages/events/page-moved.event.js';
import { PagePublishedEvent } from '../../pages/events/page-published.event.js';
import { PageRestoredEvent } from '../../pages/events/page-restored.event.js';
import { PageTrashedEvent } from '../../pages/events/page-trashed.event.js';
import { PageVersionCreatedEvent } from '../../pages/events/page-version-created.event.js';
import { PagesImportedEvent } from '../../pages/events/pages-imported.event.js';
import { PageReferenceService } from '../../pages/services/page-reference.service.js';
import { WebhookDeliveryService } from './webhook-delivery.service.js';
import { WebhookEventsListener } from './webhook-events.listener.js';

const guide: PageReferenceDto = {
  id: 'guide',
  title: 'Guide',
  path: '/docs/guide',
  visibility: 'public',
  ancestorIds: ['docs'],
  inTrash: false,
};

describe('WebhookEventsListener', () => {
  let listener: WebhookEventsListener;
  let publish: Mock<WebhookDeliveryService['publish']>;
  let hasSubscribers: Mock<WebhookDeliveryService['hasSubscribers']>;
  let describePage: Mock<PageReferenceService['describe']>;

  beforeEach(async () => {
    publish = vi.fn().mockResolvedValue(undefined);
    hasSubscribers = vi.fn().mockResolvedValue(true);
    describePage = vi.fn().mockResolvedValue(guide);
    const moduleRef = await Test.createTestingModule({
      providers: [
        WebhookEventsListener,
        {
          provide: WebhookDeliveryService,
          useValue: { publish, hasSubscribers },
        },
        { provide: PageReferenceService, useValue: { describe: describePage } },
      ],
    }).compile();
    listener = moduleRef.get(WebhookEventsListener);
  });

  it.each([
    [
      'page.created',
      () => listener.onPageCreated(new PageCreatedEvent('guide', 'user-1')),
      {},
    ],
    [
      'page.updated',
      () =>
        listener.onPageVersionCreated(
          new PageVersionCreatedEvent(
            'guide',
            'v2',
            'user-1',
            'Guide',
            'secret content',
            'Typo',
            new Date(),
          ),
        ),
      { versionId: 'v2', changeSummary: 'Typo' },
    ],
    [
      'page.moved',
      () =>
        listener.onPageMoved(
          new PageMovedEvent('guide', 'user-1', '/guide', '/docs/guide'),
        ),
      { fromPath: '/guide', toPath: '/docs/guide' },
    ],
    [
      'page.deleted',
      () => listener.onPageTrashed(new PageTrashedEvent('guide', 'user-1', 2)),
      { descendantCount: 2 },
    ],
    [
      'page.restored',
      () => listener.onPageRestored(new PageRestoredEvent('guide', 'user-1')),
      {},
    ],
    [
      'page.published',
      () =>
        listener.onPagePublished(
          new PagePublishedEvent('guide', 'guide', 'Guide', 'user-1'),
        ),
      {},
    ],
    [
      'comment.created',
      () =>
        listener.onCommentCreated(
          new CommentCreatedEvent('comment-1', 'guide', 'user-1'),
        ),
      { commentId: 'comment-1' },
    ],
  ])(
    'publishes %s for the page, without its content',
    async (event, handle, data) => {
      await handle();

      expect(describePage).toHaveBeenCalledWith('guide');
      expect(publish).toHaveBeenCalledWith(event, {
        actorId: 'user-1',
        page: guide,
        data,
      });
    },
  );

  it('publishes an import with its root page', async () => {
    await listener.onPagesImported(
      new PagesImportedEvent('user-1', 10, 2, 'guide'),
    );

    expect(publish).toHaveBeenCalledWith('pages.imported', {
      actorId: 'user-1',
      page: guide,
      data: { pageCount: 12, createdCount: 10, updatedCount: 2 },
    });
  });

  it('publishes an import at the root without a page', async () => {
    await listener.onPagesImported(
      new PagesImportedEvent('user-1', 3, 0, null),
    );

    expect(describePage).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith('pages.imported', {
      actorId: 'user-1',
      page: null,
      data: { pageCount: 3, createdCount: 3, updatedCount: 0 },
    });
  });

  it('ignores a new version of a page in the trash', async () => {
    describePage.mockResolvedValue({ ...guide, inTrash: true });

    await listener.onPageVersionCreated(
      new PageVersionCreatedEvent(
        'guide',
        'v2',
        'user-1',
        'Guide',
        '',
        null,
        new Date(),
      ),
    );

    expect(publish).not.toHaveBeenCalled();
  });

  it('does not even look the page up when no webhook listens to the event', async () => {
    hasSubscribers.mockResolvedValue(false);

    await listener.onPageCreated(new PageCreatedEvent('guide', 'user-1'));
    await listener.onPageVersionCreated(
      new PageVersionCreatedEvent(
        'guide',
        'v2',
        'user-1',
        'Guide',
        '',
        null,
        new Date(),
      ),
    );

    expect(hasSubscribers).toHaveBeenCalledWith('page.created');
    expect(hasSubscribers).toHaveBeenCalledWith('page.updated');
    expect(describePage).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('skips a page that no longer exists', async () => {
    describePage.mockResolvedValue(null);

    await listener.onPageCreated(new PageCreatedEvent('gone', 'user-1'));

    expect(publish).not.toHaveBeenCalled();
  });

  it('never lets a failure escape to the code that emitted the event', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    publish.mockRejectedValue(new Error('database down'));

    await expect(
      listener.onPageCreated(new PageCreatedEvent('guide', 'user-1')),
    ).resolves.toBeUndefined();
  });
});
