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
    const reindexed = await reindexStalePageLinks(
      (query, parameters) => dataSource.query(query, parameters),
      (process.env.FRONTEND_URL ?? '').replace(/\/+$/, ''),
    );
    console.log(`Page links backfill complete: ${reindexed} page(s) indexed.`);
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
