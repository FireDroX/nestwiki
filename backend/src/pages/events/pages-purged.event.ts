export const PAGES_PURGED_EVENT = 'pages.purged';

export class PagesPurgedEvent {
  constructor(public readonly detachedAttachmentIds: string[]) {}
}
