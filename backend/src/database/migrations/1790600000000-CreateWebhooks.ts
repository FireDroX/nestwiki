import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWebhooks1790600000000 implements MigrationInterface {
  name = 'CreateWebhooks1790600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`webhooks\` (\`id\` varchar(36) NOT NULL, \`name\` varchar(100) NOT NULL, \`url\` varchar(2048) NOT NULL, \`format\` enum ('json', 'discord', 'slack') NOT NULL DEFAULT 'json', \`events\` json NOT NULL, \`secret\` varchar(64) NOT NULL, \`enabled\` tinyint NOT NULL DEFAULT 1, \`include_private_pages\` tinyint NOT NULL DEFAULT 0, \`scope_page_id\` varchar(36) NULL, \`consecutive_failures\` int NOT NULL DEFAULT 0, \`disabled_reason\` varchar(255) NULL, \`created_by_id\` varchar(36) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`webhook_deliveries\` (\`id\` varchar(36) NOT NULL, \`webhook_id\` varchar(36) NOT NULL, \`event\` varchar(50) NOT NULL, \`payload\` mediumtext NOT NULL, \`status\` enum ('pending', 'success', 'failed') NOT NULL DEFAULT 'pending', \`attempts\` int NOT NULL DEFAULT 0, \`next_attempt_at\` datetime(6) NULL, \`last_status_code\` int NULL, \`last_error\` varchar(500) NULL, \`duration_ms\` int NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`delivered_at\` datetime(6) NULL, INDEX \`IDX_webhook_deliveries_status_next_attempt\` (\`status\`, \`next_attempt_at\`), INDEX \`IDX_webhook_deliveries_webhook_created\` (\`webhook_id\`, \`created_at\`), PRIMARY KEY (\`id\`), CONSTRAINT \`FK_webhook_deliveries_webhook_id\` FOREIGN KEY (\`webhook_id\`) REFERENCES \`webhooks\` (\`id\`) ON DELETE CASCADE) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`webhook_deliveries\``);
    await queryRunner.query(`DROP TABLE \`webhooks\``);
  }
}
