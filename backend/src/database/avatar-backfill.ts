import { Client } from 'minio';
import { AVATAR_MIME_TO_EXTENSION } from '../common/variables.global.js';

type RunQuery = (query: string, parameters?: unknown[]) => Promise<unknown>;

const AVATAR_PREFIX = 'avatars/';

const AVATAR_KEY_REGEX = /^avatars\/([^/]+)\/avatar\.([a-z0-9]+)$/;

export function createMinioClientFromEnv(): Client {
  return new Client({
    endPoint: process.env.MINIO_ENDPOINT!,
    port: Number(process.env.MINIO_PORT),
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    useSSL: process.env.MINIO_USE_SSL === 'true',
  });
}

async function listStoredAvatarExtensions(
  minio: Client,
  bucket: string,
): Promise<Map<string, string>> {
  const allowedExtensions = new Set(Object.values(AVATAR_MIME_TO_EXTENSION));
  const extensionByUserId = new Map<string, string>();
  for await (const item of minio.listObjectsV2(bucket, AVATAR_PREFIX, true)) {
    const match = AVATAR_KEY_REGEX.exec((item as { name?: string }).name ?? '');
    if (match && allowedExtensions.has(match[2])) {
      extensionByUserId.set(match[1], match[2]);
    }
  }
  return extensionByUserId;
}

export async function backfillAvatarExtensions(
  runQuery: RunQuery,
  minio: Client,
  bucket: string,
): Promise<number> {
  const extensionByUserId = await listStoredAvatarExtensions(minio, bucket);
  const usersWithoutAvatar = (await runQuery(
    'SELECT `id` FROM `users` WHERE `avatar_extension` IS NULL',
  )) as { id: string }[];

  let restored = 0;
  for (const { id } of usersWithoutAvatar) {
    const extension = extensionByUserId.get(id);
    if (extension) {
      await runQuery(
        'UPDATE `users` SET `avatar_extension` = ? WHERE `id` = ? AND `avatar_extension` IS NULL',
        [extension, id],
      );
      restored += 1;
    }
  }
  return restored;
}
