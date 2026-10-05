import { execFileSync } from 'node:child_process';
import 'dotenv/config';
import mysql from 'mysql2/promise';

function resolveTestDatabaseName() {
  return (
    process.env.DB_DATABASE_TEST ??
    `${process.env.DB_DATABASE ?? 'nestwiki'}_test`
  );
}

/**
 * Creates the e2e test database (if missing) and runs pending migrations
 * against it, so every e2e run starts from a freshly-migrated schema.
 *
 * Migrations are shelled out to the existing `migration:run` script
 * instead of loading `src/database/migrations/*.ts` directly here: those
 * files (and the entities TypeORM builds metadata from) use decorators
 * and interface-only imports that Node's native TS loader can't handle,
 * while `tsx` (already used by `migration:run` in dev/CI) transforms
 * them the same way it does for a real deploy.
 */
export default async function setup() {
  const database = resolveTestDatabaseName();

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
  });
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
  await connection.end();

  execFileSync(
    'pnpm',
    ['run', 'migration:run'],
    {
      cwd: `${import.meta.dirname}/../..`,
      env: { ...process.env, DB_DATABASE: database },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  );
}
