import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePermissionsAndGroups1789800000000 implements MigrationInterface {
  name = 'CreatePermissionsAndGroups1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`groups\` (\`id\` varchar(36) NOT NULL, \`name\` varchar(100) NOT NULL, \`description\` varchar(500) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_groups_name\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`group_members\` (\`group_id\` varchar(36) NOT NULL, \`user_id\` varchar(36) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`group_id\`, \`user_id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`group_members\` ADD CONSTRAINT \`FK_group_members_group_id\` FOREIGN KEY (\`group_id\`) REFERENCES \`groups\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`group_members\` ADD CONSTRAINT \`FK_group_members_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    await queryRunner.query(
      `CREATE TABLE \`user_permissions\` (\`user_id\` varchar(36) NOT NULL, \`permission\` varchar(50) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`user_id\`, \`permission\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_permissions\` ADD CONSTRAINT \`FK_user_permissions_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    await queryRunner.query(
      `CREATE TABLE \`group_permissions\` (\`group_id\` varchar(36) NOT NULL, \`permission\` varchar(50) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`group_id\`, \`permission\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`group_permissions\` ADD CONSTRAINT \`FK_group_permissions_group_id\` FOREIGN KEY (\`group_id\`) REFERENCES \`groups\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    await queryRunner.query(
      `CREATE TABLE \`page_access_rules\` (\`id\` varchar(36) NOT NULL, \`user_id\` varchar(36) NULL, \`group_id\` varchar(36) NULL, \`page_id\` varchar(36) NULL, \`applies_to\` enum('page','subtree') NOT NULL, \`actions\` json NOT NULL, \`granted_by_id\` varchar(36) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_page_access_rules_user_id\` (\`user_id\`), INDEX \`IDX_page_access_rules_group_id\` (\`group_id\`), INDEX \`IDX_page_access_rules_page_id\` (\`page_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`page_access_rules\` ADD CONSTRAINT \`FK_page_access_rules_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`page_access_rules\` ADD CONSTRAINT \`FK_page_access_rules_group_id\` FOREIGN KEY (\`group_id\`) REFERENCES \`groups\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`page_access_rules\` ADD CONSTRAINT \`FK_page_access_rules_page_id\` FOREIGN KEY (\`page_id\`) REFERENCES \`pages\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    // MySQL 8 forbids a CHECK constraint on a column that also carries a
    // CASCADE/SET NULL foreign-key action (error 3823), and user_id/group_id
    // both need ON DELETE CASCADE — so the "exactly one of user_id/group_id"
    // invariant is enforced by triggers instead of a CHECK constraint.
    await queryRunner.query(`
      CREATE TRIGGER \`trg_page_access_rules_subject_insert\` BEFORE INSERT ON \`page_access_rules\`
      FOR EACH ROW
      BEGIN
        IF (NEW.user_id IS NULL) = (NEW.group_id IS NULL) THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'page_access_rules requires exactly one of user_id or group_id';
        END IF;
      END
    `);
    await queryRunner.query(`
      CREATE TRIGGER \`trg_page_access_rules_subject_update\` BEFORE UPDATE ON \`page_access_rules\`
      FOR EACH ROW
      BEGIN
        IF (NEW.user_id IS NULL) = (NEW.group_id IS NULL) THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'page_access_rules requires exactly one of user_id or group_id';
        END IF;
      END
    `);

    await queryRunner.query(
      `CREATE TABLE \`page_access_exclusions\` (\`rule_id\` varchar(36) NOT NULL, \`page_id\` varchar(36) NOT NULL, PRIMARY KEY (\`rule_id\`, \`page_id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`page_access_exclusions\` ADD CONSTRAINT \`FK_page_access_exclusions_rule_id\` FOREIGN KEY (\`rule_id\`) REFERENCES \`page_access_rules\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`page_access_exclusions\` ADD CONSTRAINT \`FK_page_access_exclusions_page_id\` FOREIGN KEY (\`page_id\`) REFERENCES \`pages\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`is_active\` tinyint NOT NULL DEFAULT 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`is_active\``);

    await queryRunner.query(
      `ALTER TABLE \`page_access_exclusions\` DROP FOREIGN KEY \`FK_page_access_exclusions_page_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`page_access_exclusions\` DROP FOREIGN KEY \`FK_page_access_exclusions_rule_id\``,
    );
    await queryRunner.query(`DROP TABLE \`page_access_exclusions\``);

    await queryRunner.query(
      `DROP TRIGGER \`trg_page_access_rules_subject_update\``,
    );
    await queryRunner.query(
      `DROP TRIGGER \`trg_page_access_rules_subject_insert\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`page_access_rules\` DROP FOREIGN KEY \`FK_page_access_rules_page_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`page_access_rules\` DROP FOREIGN KEY \`FK_page_access_rules_group_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`page_access_rules\` DROP FOREIGN KEY \`FK_page_access_rules_user_id\``,
    );
    await queryRunner.query(`DROP TABLE \`page_access_rules\``);

    await queryRunner.query(
      `ALTER TABLE \`group_permissions\` DROP FOREIGN KEY \`FK_group_permissions_group_id\``,
    );
    await queryRunner.query(`DROP TABLE \`group_permissions\``);

    await queryRunner.query(
      `ALTER TABLE \`user_permissions\` DROP FOREIGN KEY \`FK_user_permissions_user_id\``,
    );
    await queryRunner.query(`DROP TABLE \`user_permissions\``);

    await queryRunner.query(
      `ALTER TABLE \`group_members\` DROP FOREIGN KEY \`FK_group_members_user_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`group_members\` DROP FOREIGN KEY \`FK_group_members_group_id\``,
    );
    await queryRunner.query(`DROP TABLE \`group_members\``);

    await queryRunner.query(`DROP INDEX \`IDX_groups_name\` ON \`groups\``);
    await queryRunner.query(`DROP TABLE \`groups\``);
  }
}
