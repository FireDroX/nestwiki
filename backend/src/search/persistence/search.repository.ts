export interface SearchMatchTag {
  id: string;
  name: string;
  color: string;
}

export interface SearchMatch {
  pageId: string;
  slug: string;
  title: string;
  content: string;
  score: number;
  tags: SearchMatchTag[];
}

export interface SearchRepository {
  search(
    query: string,
    page: number,
    limit: number,
    readablePageIds: string[] | null,
  ): Promise<{ items: SearchMatch[]; total: number }>;
}
