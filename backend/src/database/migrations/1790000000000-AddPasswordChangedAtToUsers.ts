import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordChangedAtToUsers1790000000000 implements MigrationInterface {
  name = 'AddPasswordChangedAtToUsers1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD COLUMN \`password_changed_at\` datetime NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`password_changed_at\``,
    );
  }
}
