import { Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PageCreatedEvent } from '../../pages/events/page-created.event.js';
import { PageVersionCreatedEvent } from '../../pages/events/page-version-created.event.js';
import { PagesPurgedEvent } from '../../pages/events/pages-purged.event.js';
import { MediaPageEventsListener } from './media-page-events.listener.js';
import type { MediaService } from './media.service.js';

describe('MediaPageEventsListener', () => {
  let mediaService: {
    attachUploadsReferencedBy: ReturnType<typeof vi.fn>;
    releaseDetachedAttachments: ReturnType<typeof vi.fn>;
  };
  let listener: MediaPageEventsListener;

  beforeEach(() => {
    mediaService = {
      attachUploadsReferencedBy: vi.fn().mockResolvedValue(undefined),
      releaseDetachedAttachments: vi.fn().mockResolvedValue(undefined),
    };
    listener = new MediaPageEventsListener(
      mediaService as unknown as MediaService,
    );
  });

  it('attaches uploads embedded in a new page to it', async () => {
    await listener.onPageCreated(
      new PageCreatedEvent('page-1', 'u1', 'content'),
    );

    expect(mediaService.attachUploadsReferencedBy).toHaveBeenCalledWith(
      'page-1',
      'content',
      'u1',
    );
  });

  it('attaches uploads embedded in a new version to the page', async () => {
    await listener.onPageVersionCreated(
      new PageVersionCreatedEvent(
        'page-1',
        'v2',
        'u2',
        'Title',
        'new content',
        null,
        new Date(),
      ),
    );

    expect(mediaService.attachUploadsReferencedBy).toHaveBeenCalledWith(
      'page-1',
      'new content',
      'u2',
    );
  });

  it('releases the attachments a purge left without a page', async () => {
    await listener.onPagesPurged(new PagesPurgedEvent(['a1']));

    expect(mediaService.releaseDetachedAttachments).toHaveBeenCalledWith([
      'a1',
    ]);
  });

  it('logs a failure instead of rejecting', async () => {
    const error = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    mediaService.releaseDetachedAttachments.mockRejectedValue(
      new Error('db down'),
    );

    await expect(
      listener.onPagesPurged(new PagesPurgedEvent(['a1'])),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('db down'));
    error.mockRestore();
  });
});
