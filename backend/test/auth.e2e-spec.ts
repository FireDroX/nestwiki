import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { dataOf } from './support/api-response.js';
import { createTestApp } from './support/create-test-app.js';
import { resetDatabase } from './support/reset-database.js';

interface UserProfile {
  email: string;
  displayName: string;
  role: string;
  passwordHash?: string;
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let close: () => Promise<void>;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, close } = await createTestApp());
    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await resetDatabase(dataSource);
  });

  afterAll(async () => {
    await close();
  });

  it('registers, logs in, then fetches the connected profile with the session it opens', async () => {
    const agent = request.agent(
      app.getHttpServer() as Parameters<typeof request>[0],
    );
    const email = 'alice@example.com';
    const password = 'Str0ng!Passw0rd';

    const registerResponse = await agent.post('/api/auth/register').send({
      email,
      password,
      displayName: 'Alice',
      turnstileToken: 'stubbed',
    });

    expect(registerResponse.status).toBe(201);
    expect(dataOf<UserProfile>(registerResponse)).toMatchObject({
      email,
      displayName: 'Alice',
      role: 'member',
    });

    const loginResponse = await agent.post('/api/auth/login').send({
      email,
      password,
      turnstileToken: 'stubbed',
    });

    expect(loginResponse.status).toBe(200);
    const setCookieHeader: string[] = Array.isArray(
      loginResponse.headers['set-cookie'],
    )
      ? (loginResponse.headers['set-cookie'] as string[])
      : [];
    expect(
      setCookieHeader.some((cookie) => cookie.startsWith('accessToken=')),
    ).toBe(true);

    const meResponse = await agent.get('/api/users/me');

    expect(meResponse.status).toBe(200);
    const profile = dataOf<UserProfile>(meResponse);
    expect(profile).toMatchObject({
      email,
      displayName: 'Alice',
      role: 'member',
    });
    expect(profile.passwordHash).toBeUndefined();
  });

  it('rejects GET /api/users/me without a session', async () => {
    const response = await request(
      app.getHttpServer() as Parameters<typeof request>[0],
    ).get('/api/users/me');

    expect(response.status).toBe(401);
  });

  it('rejects registration with a duplicate email with 409', async () => {
    const email = 'bob@example.com';
    const payload = {
      email,
      password: 'Str0ng!Passw0rd',
      displayName: 'Bob',
      turnstileToken: 'stubbed',
    };
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];

    await request(httpServer)
      .post('/api/auth/register')
      .send(payload)
      .expect(201);

    const response = await request(httpServer)
      .post('/api/auth/register')
      .send(payload);

    expect(response.status).toBe(409);
  });

  it('rejects login with a wrong password with 401', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];

    await request(httpServer).post('/api/auth/register').send({
      email: 'carol@example.com',
      password: 'Str0ng!Passw0rd',
      displayName: 'Carol',
      turnstileToken: 'stubbed',
    });

    const response = await request(httpServer).post('/api/auth/login').send({
      email: 'carol@example.com',
      password: 'WrongPassw0rd!',
      turnstileToken: 'stubbed',
    });

    expect(response.status).toBe(401);
  });
});
