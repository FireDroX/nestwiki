import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { MAX_ATTACHMENT_SIZE_BYTES } from '../common/variables.global.js';
import { MediaController } from './media.controller.js';
import { MediaService } from './services/media.service.js';

type HttpServer = Parameters<typeof request>[0];

describe('MediaController', () => {
  let app: INestApplication;
  const uploadFile = vi.fn();

  beforeEach(async () => {
    uploadFile.mockReset();
    const moduleRef = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [{ provide: MediaService, useValue: { uploadFile } }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('refuses a file over the size limit before it reaches the service', async () => {
    const response = await request(app.getHttpServer() as HttpServer)
      .post('/media/upload')
      .attach('file', Buffer.alloc(MAX_ATTACHMENT_SIZE_BYTES + 1), 'big.png');

    expect(response.status).toBe(413);
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('refuses a second file in the same request', async () => {
    const response = await request(app.getHttpServer() as HttpServer)
      .post('/media/upload')
      .attach('file', Buffer.from([1]), 'a.png')
      .attach('file', Buffer.from([2]), 'b.png');

    expect(response.status).toBe(400);
    expect(uploadFile).not.toHaveBeenCalled();
  });
});
