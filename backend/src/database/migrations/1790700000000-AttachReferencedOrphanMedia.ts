import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttachReferencedOrphanMedia1790700000000 implements MigrationInterface {
  name = 'AttachReferencedOrphanMedia1790700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE attachments a
       SET a.page_id = (
         SELECT p.id
         FROM pages p
         INNER JOIN page_versions pv ON pv.id = p.current_version_id
         WHERE pv.content LIKE CONCAT('%/media/', a.id, '/raw%')
            OR (
              SUBSTRING_INDEX(a.minio_key, '/', -1) REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
              AND pv.content LIKE CONCAT('%', LEFT(SUBSTRING_INDEX(a.minio_key, '/', -1), 36), '%')
            )
         ORDER BY (p.deleted_at IS NOT NULL), p.created_at, p.id
         LIMIT 1
       )
       WHERE a.page_id IS NULL`,
    );
  }

  public async down(): Promise<void> {}
}
