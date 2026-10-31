export const PAGE_CREATED_EVENT = 'page.created';

export class PageCreatedEvent {
  constructor(
    public readonly pageId: string,
    public readonly actorId: string,
    public readonly content: string,
  ) {}
}
