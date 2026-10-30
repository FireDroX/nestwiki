import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { AVATAR_MAX_SIZE_BYTES } from '../common/variables.global.js';
import { UsersService } from './services/users.service.js';
import { UsersController } from './users.controller.js';

type HttpServer = Parameters<typeof request>[0];

describe('UsersController', () => {
  let app: INestApplication;
  const uploadAvatar = vi.fn();

  beforeEach(async () => {
    uploadAvatar.mockReset();
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
    })
      .useMocker((token) => (token === UsersService ? { uploadAvatar } : {}))
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('refuses an avatar over the size limit before it reaches the service', async () => {
    const response = await request(app.getHttpServer() as HttpServer)
      .post('/users/me/avatar')
      .attach('file', Buffer.alloc(AVATAR_MAX_SIZE_BYTES + 1), 'big.png');

    expect(response.status).toBe(413);
    expect(uploadAvatar).not.toHaveBeenCalled();
  });
});
