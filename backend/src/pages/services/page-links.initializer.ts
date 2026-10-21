import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { reindexStalePageLinks } from '../../database/page-links-index.js';

@Injectable()
export class PageLinksInitializer implements OnApplicationBootstrap {
  private readonly logger = new Logger(PageLinksInitializer.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const instanceUrl = (
      this.configService.get<string>('FRONTEND_URL') ?? ''
    ).replace(/\/+$/, '');
    try {
      const { indexed, failedPageIds } = await reindexStalePageLinks(
        (query, parameters) => this.dataSource.query(query, parameters),
        (work) =>
          this.dataSource.transaction((manager) =>
            work((query, parameters) => manager.query(query, parameters)),
          ),
        instanceUrl,
      );
      if (indexed > 0) {
        this.logger.log(`Links indexed for ${indexed} page(s)`);
      }
      if (failedPageIds.length > 0) {
        this.logger.warn(
          `Links not indexed for page(s) ${failedPageIds.join(', ')}, retried at next startup`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Page links not indexed, retried at next startup: ${String(error)}`,
      );
    }
  }
}
