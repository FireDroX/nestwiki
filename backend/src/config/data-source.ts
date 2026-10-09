import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * CLI-only DataSource, used by the `migration:*` scripts: run against raw
 * TS in `src/` via `tsx` in dev/CI, and against compiled `dist/` via plain
 * `node` in the Docker image (see entrypoint.sh). Not wired into Nest's
 * DI — env vars are loaded directly via `dotenv/config` since there's no
 * ConfigModule outside a running Nest app.
 */
const sourceExtension = import.meta.filename.endsWith('.ts') ? 'ts' : 'js';

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: 'Z',
  synchronize: false,
  entities: [`${import.meta.dirname}/../**/*.entity.${sourceExtension}`],
  migrations: [
    `${import.meta.dirname}/../database/migrations/*.${sourceExtension}`,
  ],
});
