import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import {
  defaultAdminSettingsFromEnv,
  ensureDefaultAdmin,
  type DefaultAdminStore,
} from './default-admin.js';

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

function userStore(): DefaultAdminStore {
  const users = dataSource.getRepository(User);
  return {
    countAdmins: () => users.count({ where: { role: 'admin' } }),
    findByEmail: (email) => users.findOneBy({ email }),
    createAdmin: async (admin) => {
      await users.save(users.create({ ...admin, role: 'admin' }));
    },
  };
}

async function run(): Promise<void> {
  await dataSource.initialize();
  try {
    const settings = defaultAdminSettingsFromEnv(process.env);
    const outcome = await ensureDefaultAdmin(userStore(), settings);
    console.log(
      outcome === 'created'
        ? `Default admin account created for ${settings.email}.`
        : 'An admin account already exists, nothing to do.',
    );
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
