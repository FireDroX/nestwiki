import type { PageVisibility } from '../../pages/entities/page.entity.js';

export interface ImportedPageInput {
  id: string;
  versionId: string;
  parentId: string | null;
  slug: string;
  title: string;
  content: string;
  visibility: PageVisibility;
}

export interface ImportedVersionInput {
  pageId: string;
  versionId: string;
  title: string;
  content: string;
}

export interface ImportedAttachmentInput {
  id: string;
  pageId: string;
  minioKey: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface ImportedTagInput {
  id: string;
  name: string;
  color: string;
}

export interface ImportWriteInput {
  authorId: string;
  changeSummary: string;
  createdPages: ImportedPageInput[];
  updatedPages: ImportedVersionInput[];
  attachments: ImportedAttachmentInput[];
  tags: ImportedTagInput[];
  pageTags: { pageId: string; tagId: string }[];
}

export interface ImportsRepository {
  write(input: ImportWriteInput): Promise<void>;
}
