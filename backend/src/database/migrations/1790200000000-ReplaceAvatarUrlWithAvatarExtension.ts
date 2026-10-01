import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceAvatarUrlWithAvatarExtension1790200000000 implements MigrationInterface {
  name = 'ReplaceAvatarUrlWithAvatarExtension1790200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD COLUMN \`avatar_extension\` varchar(10) NULL`,
    );
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`avatar_url\``);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD COLUMN \`avatar_url\` varchar(500) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`avatar_extension\``,
    );
  }
}
