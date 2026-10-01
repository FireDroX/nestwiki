import { DataSource } from 'typeorm';

const E2E_TABLES = [
  'page_access_exclusions',
  'page_access_rules',
  'group_permissions',
  'user_permissions',
  'group_members',
  'groups',
  'page_versions',
  'pages',
  'users',
];

/**
 * Wipes the tables touched by the e2e suites. Each spec file calls this
 * between tests so they don't leak state into one another — `TRUNCATE`
 * with FK checks disabled rather than a manual dependency-respecting
 * order, since the test database is disposable and never shared with a
 * real environment.
 */
export async function resetDatabase(dataSource: DataSource): Promise<void> {
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of E2E_TABLES) {
    await dataSource.query(`TRUNCATE TABLE \`${table}\``);
  }
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
}
