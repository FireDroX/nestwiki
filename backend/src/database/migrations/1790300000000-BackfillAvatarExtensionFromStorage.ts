import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  backfillAvatarExtensions,
  createMinioClientFromEnv,
} from '../avatar-backfill.js';

export class BackfillAvatarExtensionFromStorage1790300000000 implements MigrationInterface {
  name = 'BackfillAvatarExtensionFromStorage1790300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    try {
      const restored = await backfillAvatarExtensions(
        (query, parameters) => queryRunner.query(query, parameters),
        createMinioClientFromEnv(),
        process.env.MINIO_BUCKET!,
      );
      console.log(`Avatar backfill: ${restored} avatar(s) restored.`);
    } catch (error) {
      console.warn(
        'Avatar backfill skipped (storage unreachable?) — run `pnpm run backfill:avatars` manually once it is back.',
        error,
      );
    }
  }

  public async down(): Promise<void> {}
}
