import { Page } from '../entities/page.entity.js';

export class PagePathIndex {
  private readonly pathById = new Map<string, string>();
  private readonly idByPath = new Map<string, string>();

  constructor(pages: Page[]) {
    const pagesById = new Map(pages.map((page) => [page.id, page]));
    for (const page of pages) {
      const path = PagePathIndex.buildPath(page, pagesById);
      if (path !== null) {
        this.pathById.set(page.id, path);
        this.idByPath.set(path.toLowerCase(), page.id);
      }
    }
  }

  pathOf(pageId: string): string | undefined {
    return this.pathById.get(pageId);
  }

  resolve(path: string): string | undefined {
    return this.idByPath.get(path.toLowerCase());
  }

  private static buildPath(
    page: Page,
    pagesById: Map<string, Page>,
  ): string | null {
    const segments = [page.slug];
    const visited = new Set([page.id]);
    let parentId = page.parentId;
    while (parentId !== null) {
      const parent = pagesById.get(parentId);
      if (!parent || visited.has(parent.id)) {
        return null;
      }
      visited.add(parent.id);
      segments.unshift(parent.slug);
      parentId = parent.parentId;
    }
    return `/${segments.join('/')}`;
  }
}
