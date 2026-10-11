import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrashColumnsToPages1790400000000 implements MigrationInterface {
  name = 'AddTrashColumnsToPages1790400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`pages\` ADD COLUMN \`deleted_by_id\` varchar(36) NULL, ADD COLUMN \`deletion_root_id\` varchar(36) NULL, ADD COLUMN \`active_slug\` varchar(255) AS (IF(\`deleted_at\` IS NULL, \`slug\`, NULL)) STORED`,
    );
    await queryRunner.query(
      `UPDATE \`pages\` SET \`deletion_root_id\` = \`id\` WHERE \`deleted_at\` IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_pages_deletion_root_id\` ON \`pages\` (\`deletion_root_id\`)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`IDX_pages_parent_id_active_slug\` ON \`pages\` (\`parent_id\`, \`active_slug\`)`,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_e199a6e69d360ba98e6738f02e\` ON \`pages\``,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`IDX_e199a6e69d360ba98e6738f02e\` ON \`pages\` (\`parent_id\`, \`slug\`)`,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pages_parent_id_active_slug\` ON \`pages\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pages_deletion_root_id\` ON \`pages\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`pages\` DROP COLUMN \`active_slug\`, DROP COLUMN \`deletion_root_id\`, DROP COLUMN \`deleted_by_id\``,
    );
  }
}
