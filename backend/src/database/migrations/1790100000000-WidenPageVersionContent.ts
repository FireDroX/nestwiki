import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenPageVersionContent1790100000000
  implements MigrationInterface
{
  name = 'WidenPageVersionContent1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`page_versions\` MODIFY \`content\` mediumtext NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`page_versions\` MODIFY \`content\` text NOT NULL`,
    );
  }
}
