import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateEditorRoleToPermissions1789900000000 implements MigrationInterface {
  name = 'MigrateEditorRoleToPermissions1789900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const editorsGroupId = (await queryRunner.query(`SELECT UUID() AS id`)) as {
      id: string;
    }[];
    const groupId = editorsGroupId[0].id;

    await queryRunner.query(
      `INSERT INTO \`groups\` (\`id\`, \`name\`, \`description\`) VALUES (?, 'Éditeurs', 'Créé automatiquement lors de la migration depuis le rôle editor')`,
      [groupId],
    );

    const globalPermissions = [
      'page.create_root',
      'tag.create',
      'tag.delete',
      'media.upload',
      'media.delete',
      'comment.moderate',
    ];
    for (const permission of globalPermissions) {
      await queryRunner.query(
        `INSERT INTO \`group_permissions\` (\`group_id\`, \`permission\`) VALUES (?, ?)`,
        [groupId, permission],
      );
    }

    const editors = (await queryRunner.query(
      `SELECT \`id\` FROM \`users\` WHERE \`role\` = 'editor'`,
    )) as { id: string }[];
    for (const editor of editors) {
      await queryRunner.query(
        `INSERT INTO \`group_members\` (\`group_id\`, \`user_id\`) VALUES (?, ?)`,
        [groupId, editor.id],
      );
    }

    const admins = (await queryRunner.query(
      `SELECT \`id\` FROM \`users\` WHERE \`role\` = 'admin' ORDER BY \`created_at\` ASC LIMIT 1`,
    )) as { id: string }[];
    // A brand-new database (e.g. a fresh e2e test DB, migrated before any
    // user exists) has zero admins and therefore zero editors too — skip
    // the whole-wiki rule rather than crash on a missing granted_by_id.
    // Every real deployment always has at least one admin by the time this
    // migration runs, so this only ever skips on a genuinely empty DB.
    if (admins.length > 0) {
      const editorsRuleId = (await queryRunner.query(
        `SELECT UUID() AS id`,
      )) as {
        id: string;
      }[];
      await queryRunner.query(
        `INSERT INTO \`page_access_rules\` (\`id\`, \`group_id\`, \`page_id\`, \`applies_to\`, \`actions\`, \`granted_by_id\`) VALUES (?, ?, NULL, 'subtree', ?, ?)`,
        [
          editorsRuleId[0].id,
          groupId,
          JSON.stringify([
            'page.read',
            'page.edit',
            'page.create_child',
            'page.delete',
            'page.move',
            'page.manage_visibility',
            'page.manage_tags',
            'page.restore_version',
          ]),
          admins[0].id,
        ],
      );
    }

    const pagePermissions = (await queryRunner.query(
      `SELECT pp.\`page_id\`, pp.\`user_id\`, pp.\`granted_by_id\`
       FROM \`page_permissions\` pp
       INNER JOIN \`users\` u ON u.\`id\` = pp.\`user_id\`
       INNER JOIN \`pages\` p ON p.\`id\` = pp.\`page_id\``,
    )) as { page_id: string; user_id: string; granted_by_id: string }[];
    for (const grant of pagePermissions) {
      const ruleId = (await queryRunner.query(`SELECT UUID() AS id`)) as {
        id: string;
      }[];
      await queryRunner.query(
        `INSERT INTO \`page_access_rules\` (\`id\`, \`user_id\`, \`page_id\`, \`applies_to\`, \`actions\`, \`granted_by_id\`) VALUES (?, ?, ?, 'subtree', ?, ?)`,
        [
          ruleId[0].id,
          grant.user_id,
          grant.page_id,
          JSON.stringify(['page.read', 'page.edit', 'page.create_child']),
          grant.granted_by_id,
        ],
      );
    }

    await queryRunner.query(
      `ALTER TABLE \`users\` MODIFY \`role\` enum('admin','editor','reader','member') NOT NULL DEFAULT 'reader'`,
    );
    await queryRunner.query(
      `UPDATE \`users\` SET \`role\` = 'member' WHERE \`role\` IN ('editor', 'reader')`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` MODIFY \`role\` enum('admin','member') NOT NULL DEFAULT 'member'`,
    );

    await queryRunner.query(`DROP TABLE \`page_permissions\``);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`page_permissions\` (\`id\` varchar(36) NOT NULL, \`page_id\` varchar(36) NOT NULL, \`user_id\` varchar(36) NOT NULL, \`granted_by_id\` varchar(36) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_1c1ec8827e57e0968d2f787224\` (\`page_id\`, \`user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    const directPageEditRules = (await queryRunner.query(
      `SELECT \`id\`, \`user_id\`, \`page_id\`, \`granted_by_id\`, \`created_at\` FROM \`page_access_rules\` WHERE \`user_id\` IS NOT NULL AND \`page_id\` IS NOT NULL AND JSON_CONTAINS(\`actions\`, '"page.edit"')`,
    )) as {
      id: string;
      user_id: string;
      page_id: string;
      granted_by_id: string;
      created_at: Date;
    }[];
    for (const rule of directPageEditRules) {
      await queryRunner.query(
        `INSERT IGNORE INTO \`page_permissions\` (\`id\`, \`page_id\`, \`user_id\`, \`granted_by_id\`, \`created_at\`) VALUES (?, ?, ?, ?, ?)`,
        [
          rule.id,
          rule.page_id,
          rule.user_id,
          rule.granted_by_id,
          rule.created_at,
        ],
      );
    }

    await queryRunner.query(
      `ALTER TABLE \`users\` MODIFY \`role\` enum('admin','editor','reader','member') NOT NULL DEFAULT 'reader'`,
    );

    const [editorsGroup] = (await queryRunner.query(
      `SELECT \`id\` FROM \`groups\` WHERE \`name\` = 'Éditeurs'`,
    )) as { id: string }[];
    if (editorsGroup) {
      const members = (await queryRunner.query(
        `SELECT \`user_id\` FROM \`group_members\` WHERE \`group_id\` = ?`,
        [editorsGroup.id],
      )) as { user_id: string }[];
      for (const member of members) {
        await queryRunner.query(
          `UPDATE \`users\` SET \`role\` = 'editor' WHERE \`id\` = ? AND \`role\` = 'member'`,
          [member.user_id],
        );
      }
      await queryRunner.query(
        `UPDATE \`users\` SET \`role\` = 'reader' WHERE \`role\` = 'member'`,
      );
      await queryRunner.query(`DELETE FROM \`groups\` WHERE \`id\` = ?`, [
        editorsGroup.id,
      ]);
    } else {
      await queryRunner.query(
        `UPDATE \`users\` SET \`role\` = 'reader' WHERE \`role\` = 'member'`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE \`users\` MODIFY \`role\` enum('admin','editor','reader') NOT NULL DEFAULT 'reader'`,
    );
  }
}
