export const PAGE_TRASHED_EVENT = 'page.trashed';

export class PageTrashedEvent {
  constructor(
    public readonly pageId: string,
    public readonly actorId: string,
    public readonly descendantCount: number,
  ) {}
}
