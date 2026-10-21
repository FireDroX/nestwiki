export const PAGE_PUBLISHED_EVENT = 'page.published';

export class PagePublishedEvent {
  constructor(
    public readonly pageId: string,
    public readonly slug: string,
    public readonly title: string,
    public readonly actorId: string,
  ) {}
}
