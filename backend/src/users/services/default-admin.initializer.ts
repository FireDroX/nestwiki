import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  defaultAdminSettingsFromEnv,
  ensureDefaultAdmin,
  type DefaultAdminStore,
} from '../../database/default-admin.js';
import type { UserRepository } from '../persistence/user.repository.js';

@Injectable()
export class DefaultAdminInitializer implements OnApplicationBootstrap {
  private readonly logger = new Logger(DefaultAdminInitializer.name);

  constructor(
    @Inject('UsersRepository') private readonly usersRepository: UserRepository,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const settings = defaultAdminSettingsFromEnv({
      ADMIN_EMAIL: this.configService.get<string>('ADMIN_EMAIL'),
      ADMIN_PASSWORD: this.configService.get<string>('ADMIN_PASSWORD'),
      ADMIN_DISPLAY_NAME: this.configService.get<string>('ADMIN_DISPLAY_NAME'),
    });

    const outcome = await ensureDefaultAdmin(this.store(), settings);
    if (outcome === 'created') {
      this.logger.log(`Default admin account created for ${settings.email}`);
    }
  }

  private store(): DefaultAdminStore {
    return {
      countAdmins: () => this.usersRepository.countAdmins(),
      findByEmail: (email) => this.usersRepository.findByEmail(email),
      createAdmin: async (admin) => {
        await this.usersRepository.create({ ...admin, role: 'admin' });
      },
    };
  }
}
