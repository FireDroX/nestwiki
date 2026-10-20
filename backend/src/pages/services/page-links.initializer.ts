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
    const reindexed = await reindexStalePageLinks(
      (query, parameters) => this.dataSource.query(query, parameters),
      instanceUrl,
    );
    if (reindexed > 0) {
      this.logger.log(`Links indexed for ${reindexed} page(s)`);
    }
  }
}
