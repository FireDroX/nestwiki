import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module.js';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter.js';
import { PwnedPasswordService } from '../../src/security/services/pwned-password.service.js';
import { TurnstileService } from '../../src/security/services/turnstile.service.js';
import { DefaultAdminInitializer } from '../../src/users/services/default-admin.initializer.js';

export interface TestApp {
  app: INestApplication;
  close: () => Promise<void>;
}

/**
 * Boots the real `AppModule` against the e2e test database (see
 * `test/setup/test-env.ts` and `test/setup/global-setup.mjs`) — TypeORM
 * resolves entities/migrations differently under Vitest, see
 * `typeOrmConfig` in `src/config/typeorm.config.ts`. External-network
 * security checks are stubbed out so registration/login stay
 * deterministic and offline: `TurnstileService` always verifies
 * successfully, `PwnedPasswordService` never reports a password as
 * compromised. `DefaultAdminInitializer` is disabled so specs start from
 * the users they create themselves, without ADMIN_* in the environment.
 */
export async function createTestApp(): Promise<TestApp> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(TurnstileService)
    .useValue({ verify: () => Promise.resolve(true) })
    .overrideProvider(PwnedPasswordService)
    .useValue({ checkPassword: () => Promise.resolve(false) })
    .overrideProvider(DefaultAdminInitializer)
    .useValue({ onApplicationBootstrap: () => Promise.resolve() })
    .compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

  return { app, close: () => app.close() };
}
