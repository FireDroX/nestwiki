import { Attachment } from '../entities/attachment.entity.js';

export interface CreateAttachmentInput {
  pageId: string | null;
  minioKey: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedById: string;
}

export interface FindLibraryParams {
  search?: string;
  type?: 'image' | 'file';
  page: number;
  limit: number;
  readablePageIds: string[] | null;
}

export interface FindLibraryResult {
  items: Attachment[];
  total: number;
}

export interface ReferencingPage {
  id: string;
  title: string;
  inTrash: boolean;
}

export interface AttachmentsRepository {
  create(input: CreateAttachmentInput): Promise<Attachment>;
  findAllByPageId(pageId: string): Promise<Attachment[]>;
  findById(id: string): Promise<Attachment | null>;
  findByIds(ids: string[]): Promise<Attachment[]>;
  findLibrary(params: FindLibraryParams): Promise<FindLibraryResult>;
  findPagesReferencing(attachment: Attachment): Promise<ReferencingPage[]>;
  assignUnattachedToPage(
    ids: string[],
    pageId: string,
    uploadedById: string,
  ): Promise<void>;
  assignToPage(id: string, pageId: string): Promise<void>;
  delete(id: string): Promise<void>;
}
