import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePageLinks1790500000000 implements MigrationInterface {
  name = 'CreatePageLinks1790500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`page_links\` (\`source_page_id\` varchar(36) NOT NULL, \`target_path\` varchar(700) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, INDEX \`IDX_page_links_target_path\` (\`target_path\`), PRIMARY KEY (\`source_page_id\`, \`target_path\`), CONSTRAINT \`FK_page_links_source_page_id\` FOREIGN KEY (\`source_page_id\`) REFERENCES \`pages\` (\`id\`) ON DELETE CASCADE) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`pages\` ADD COLUMN \`links_version_id\` varchar(36) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`pages\` DROP COLUMN \`links_version_id\``,
    );
    await queryRunner.query(`DROP TABLE \`page_links\``);
  }
}
