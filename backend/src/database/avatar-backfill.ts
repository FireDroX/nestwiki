import 'dotenv/config';
import { Client } from 'minio';
import { DataSource, IsNull } from 'typeorm';
import { AVATAR_MIME_TO_EXTENSION } from '../common/variables.global.js';
import { User } from '../users/entities/user.entity.js';

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: 'Z',
  synchronize: false,
  entities: [User],
});

const minio = new Client({
  endPoint: process.env.MINIO_ENDPOINT!,
  port: Number(process.env.MINIO_PORT),
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
  useSSL: process.env.MINIO_USE_SSL === 'true',
});

const bucket = process.env.MINIO_BUCKET!;

async function objectExists(key: string): Promise<boolean> {
  try {
    await minio.statObject(bucket, key);
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === 'NotFound') {
      return false;
    }
    throw error;
  }
}

async function findStoredAvatarExtension(
  userId: string,
): Promise<string | null> {
  for (const extension of Object.values(AVATAR_MIME_TO_EXTENSION)) {
    if (await objectExists(`avatars/${userId}/avatar.${extension}`)) {
      return extension;
    }
  }
  return null;
}

async function run(): Promise<void> {
  await dataSource.initialize();
  const userRepository = dataSource.getRepository(User);

  const usersWithoutAvatar = await userRepository.find({
    where: { avatarExtension: IsNull() },
    select: { id: true },
  });

  let restored = 0;
  for (const user of usersWithoutAvatar) {
    const extension = await findStoredAvatarExtension(user.id);
    if (extension) {
      await userRepository.update(user.id, { avatarExtension: extension });
      restored += 1;
    }
  }

  await dataSource.destroy();
  console.log(
    `Avatar backfill complete: ${restored} avatar(s) restored out of ${usersWithoutAvatar.length} user(s) without one.`,
  );
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
