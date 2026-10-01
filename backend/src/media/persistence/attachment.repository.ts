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

export interface AttachmentsRepository {
  create(input: CreateAttachmentInput): Promise<Attachment>;
  findAllByPageId(pageId: string): Promise<Attachment[]>;
  findById(id: string): Promise<Attachment | null>;
  findLibrary(params: FindLibraryParams): Promise<FindLibraryResult>;
  findPagesReferencing(
    minioKey: string,
  ): Promise<{ id: string; title: string }[]>;
  delete(id: string): Promise<void>;
}
