export interface PageLinkRow {
  sourcePageId: string;
  targetPath: string;
}

export interface PageLinkRepository {
  replaceForPage(
    pageId: string,
    versionId: string,
    targetPaths: string[],
  ): Promise<void>;
  findSourcePageIds(
    targetPath: string,
    includeDescendants: boolean,
  ): Promise<string[]>;
  findAllFromActiveSources(): Promise<PageLinkRow[]>;
}
