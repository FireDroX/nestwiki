export const PAGE_MOVED_EVENT = 'page.moved';

export class PageMovedEvent {
  constructor(
    public readonly pageId: string,
    public readonly actorId: string,
    public readonly fromPath: string,
    public readonly toPath: string,
  ) {}
}
