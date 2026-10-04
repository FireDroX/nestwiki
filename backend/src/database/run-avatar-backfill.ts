import 'dotenv/config';
import { DataSource } from 'typeorm';
import {
  backfillAvatarExtensions,
  createMinioClientFromEnv,
} from './avatar-backfill.js';

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
    const restored = await backfillAvatarExtensions(
      (query, parameters) => dataSource.query(query, parameters),
      createMinioClientFromEnv(),
      process.env.MINIO_BUCKET!,
    );
    console.log(`Avatar backfill complete: ${restored} avatar(s) restored.`);
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
