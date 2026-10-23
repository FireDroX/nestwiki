import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Attachment } from '../../media/entities/attachment.entity.js';
import { PageVersion } from '../../pages/entities/page-version.entity.js';
import { Page } from '../../pages/entities/page.entity.js';
import { PageTag } from '../../tags/entities/page-tag.entity.js';
import { Tag } from '../../tags/entities/tag.entity.js';
import { ImportsRepository, ImportWriteInput } from './import.repository.js';

@Injectable()
export class TypeormImportsRepository implements ImportsRepository {
  constructor(private readonly dataSource: DataSource) {}

  async write(input: ImportWriteInput): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      for (const page of input.createdPages) {
        await manager.insert(Page, {
          id: page.id,
          slug: page.slug,
          title: page.title,
          parentId: page.parentId,
          visibility: page.visibility,
          createdById: input.authorId,
        });
      }

      const versions = [
        ...input.createdPages.map((page) => ({
          pageId: page.id,
          versionId: page.versionId,
          title: page.title,
          content: page.content,
        })),
        ...input.updatedPages,
      ];
      for (const version of versions) {
        await manager.insert(PageVersion, {
          id: version.versionId,
          pageId: version.pageId,
          title: version.title,
          content: version.content,
          authorId: input.authorId,
          changeSummary: input.changeSummary,
        });
        await manager.update(
          Page,
          { id: version.pageId },
          { currentVersionId: version.versionId, title: version.title },
        );
      }

      if (input.attachments.length > 0) {
        await manager.insert(
          Attachment,
          input.attachments.map((attachment) => ({
            ...attachment,
            uploadedById: input.authorId,
          })),
        );
      }
      if (input.tags.length > 0) {
        await manager.insert(Tag, input.tags);
      }
      if (input.pageTags.length > 0) {
        await manager
          .createQueryBuilder()
          .insert()
          .into(PageTag)
          .values(input.pageTags)
          .orIgnore()
          .execute();
      }
    });
  }
}
