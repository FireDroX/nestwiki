export const PAGES_IMPORTED_EVENT = 'pages.imported';

export class PagesImportedEvent {
  constructor(
    public readonly actorId: string,
    public readonly pageCount: number,
    public readonly rootPageId: string | null,
  ) {}
}
