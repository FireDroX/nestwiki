import 'dotenv/config';
import { DataSource } from 'typeorm';
import { reindexStalePageLinks } from './page-links-index.js';

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: 'Z',
  synchronize: false,
});

async function run(): Promise<void> {
  await dataSource.initialize();
  try {
    const { indexed, failedPageIds } = await reindexStalePageLinks(
      (query, parameters) => dataSource.query(query, parameters),
      (work) =>
        dataSource.transaction((manager) =>
          work((query, parameters) => manager.query(query, parameters)),
        ),
      (process.env.FRONTEND_URL ?? '').replace(/\/+$/, ''),
    );
    console.log(`Page links backfill complete: ${indexed} page(s) indexed.`);
    if (failedPageIds.length > 0) {
      console.error(
        `Links not indexed for page(s): ${failedPageIds.join(', ')}`,
      );
      process.exitCode = 1;
    }
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
