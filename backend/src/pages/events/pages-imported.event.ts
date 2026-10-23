export const PAGES_IMPORTED_EVENT = 'pages.imported';

export class PagesImportedEvent {
  constructor(
    public readonly actorId: string,
    public readonly createdCount: number,
    public readonly updatedCount: number,
    public readonly rootPageId: string | null,
  ) {}
}
