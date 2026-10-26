export const PAGE_RESTORED_EVENT = 'page.restored';

export class PageRestoredEvent {
  constructor(
    public readonly pageId: string,
    public readonly actorId: string,
  ) {}
}
