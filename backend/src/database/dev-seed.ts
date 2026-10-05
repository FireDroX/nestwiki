import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity.js';

const SALT_ROUNDS = 10;
const DEV_ADMIN_EMAIL = 'dev@nestwiki.local';
const DEV_ADMIN_PASSWORD = 'password123';

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  synchronize: false,
  entities: [User],
});

async function seedDevAdmin(dataSource: DataSource): Promise<User> {
  const userRepository = dataSource.getRepository(User);
  const existing = await userRepository.findOneBy({ email: DEV_ADMIN_EMAIL });
  if (existing) {
    console.log(`User ${DEV_ADMIN_EMAIL} already exists, skipping.`);
    return existing;
  }

  const passwordHash = await bcrypt.hash(DEV_ADMIN_PASSWORD, SALT_ROUNDS);
  const admin = await userRepository.save(
    userRepository.create({
      email: DEV_ADMIN_EMAIL,
      passwordHash,
      displayName: 'Dev Admin',
      role: 'admin',
    }),
  );
  console.log(
    `Created user ${DEV_ADMIN_EMAIL} (password: ${DEV_ADMIN_PASSWORD}).`,
  );
  return admin;
}

async function run(): Promise<void> {
  await dataSource.initialize();

  await seedDevAdmin(dataSource);

  await dataSource.destroy();
  console.log('Dev seed complete.');
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
