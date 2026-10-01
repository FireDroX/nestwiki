import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Attachment } from '../entities/attachment.entity.js';
import {
  AttachmentsRepository,
  CreateAttachmentInput,
  FindLibraryParams,
  FindLibraryResult,
} from './attachment.repository.js';

interface AttachmentRow {
  id: string;
  pageId: string | null;
  minioKey: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedById: string;
  createdAt: Date;
}

interface CountRow {
  total: string;
}

@Injectable()
export class TypeormAttachmentsRepository implements AttachmentsRepository {
  constructor(
    @InjectRepository(Attachment)
    private readonly repository: Repository<Attachment>,
    private readonly dataSource: DataSource,
  ) {}

  create(input: CreateAttachmentInput): Promise<Attachment> {
    return this.repository.save(this.repository.create(input));
  }

  findAllByPageId(pageId: string): Promise<Attachment[]> {
    return this.repository.find({
      where: { pageId },
      order: { createdAt: 'DESC' },
    });
  }

  findById(id: string): Promise<Attachment | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findLibrary(params: FindLibraryParams): Promise<FindLibraryResult> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.search) {
      conditions.push('a.filename LIKE ?');
      values.push(`%${params.search}%`);
    }

    if (params.type === 'image') {
      conditions.push("a.mime_type LIKE 'image/%'");
    } else if (params.type === 'file') {
      conditions.push("a.mime_type NOT LIKE 'image/%'");
    }

    if (params.readablePageIds !== null) {
      const publicOnlyClause = "p.visibility = 'public' AND p.is_published = 1";
      if (params.readablePageIds.length > 0) {
        conditions.push(
          `a.page_id IS NOT NULL AND (${publicOnlyClause} OR p.id IN (${params.readablePageIds.map(() => '?').join(', ')}))`,
        );
        values.push(...params.readablePageIds);
      } else {
        conditions.push(`a.page_id IS NOT NULL AND ${publicOnlyClause}`);
      }
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';
    const offset = (params.page - 1) * params.limit;

    const rows = await this.dataSource.query<AttachmentRow[]>(
      `SELECT a.id AS id, a.page_id AS pageId, a.minio_key AS minioKey,
              a.filename AS filename, a.mime_type AS mimeType, a.size AS size,
              a.uploaded_by_id AS uploadedById, a.created_at AS createdAt
       FROM attachments a
       LEFT JOIN pages p ON p.id = a.page_id AND p.deleted_at IS NULL
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, params.limit, offset],
    );

    const countRows = await this.dataSource.query<CountRow[]>(
      `SELECT COUNT(*) AS total
       FROM attachments a
       LEFT JOIN pages p ON p.id = a.page_id AND p.deleted_at IS NULL
       ${whereClause}`,
      values,
    );

    return {
      items: rows.map((row) => TypeormAttachmentsRepository.toAttachment(row)),
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  async findPagesReferencing(
    minioKey: string,
  ): Promise<{ id: string; title: string }[]> {
    const lastSegment = minioKey.split('/').pop() ?? minioKey;
    const uuidMatch = lastSegment.match(
      /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    );
    const needle = uuidMatch ? uuidMatch[1] : minioKey;

    return this.dataSource.query<{ id: string; title: string }[]>(
      `SELECT p.id AS id, pv.title AS title
       FROM pages p
       INNER JOIN page_versions pv ON pv.id = p.current_version_id
       WHERE p.deleted_at IS NULL AND pv.content LIKE ?`,
      [`%${needle}%`],
    );
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  private static toAttachment(row: AttachmentRow): Attachment {
    const attachment = new Attachment();
    attachment.id = row.id;
    attachment.pageId = row.pageId;
    attachment.minioKey = row.minioKey;
    attachment.filename = row.filename;
    attachment.mimeType = row.mimeType;
    attachment.size = row.size;
    attachment.uploadedById = row.uploadedById;
    attachment.createdAt = row.createdAt;
    return attachment;
  }
}
