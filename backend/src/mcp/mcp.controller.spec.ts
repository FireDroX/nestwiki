import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { McpAuthenticatedRequest } from './guards/mcp-api-key.guard.js';
import { McpOAuthGuard } from './guards/mcp-oauth.guard.js';
import { McpAuditInterceptor } from './interceptors/mcp-audit.interceptor.js';
import { McpController } from './mcp.controller.js';
import { McpToolsRegistry } from './registry/mcp-tools.registry.js';
import { McpServerService } from './services/mcp-server.service.js';

const CREDENTIALS: Record<string, { apiKeyId: string; createdById: string }> = {
  k1: { apiKeyId: 'key-1', createdById: 'admin-1' },
  k2: { apiKeyId: 'key-2', createdById: 'admin-2' },
  k1b: { apiKeyId: 'key-1', createdById: 'admin-1' },
};

class FakeKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<McpAuthenticatedRequest>();
    const key = String(req.headers.authorization ?? '').replace('Bearer ', '');
    req.mcpAuth = { ...CREDENTIALS[key], scopes: ['pages:read'] };
    return true;
  }
}

const MCP_HEADERS = {
  accept: 'application/json, text/event-stream',
  'content-type': 'application/json',
};

describe('McpController sessions', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [McpController],
      providers: [
        McpServerService,
        McpToolsRegistry,
        {
          provide: McpAuditInterceptor,
          useValue: {
            wrap: (...args: unknown[]) => (args[3] as () => unknown)(),
          },
        },
      ],
    })
      .overrideGuard(McpOAuthGuard)
      .useClass(FakeKeyGuard)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  async function initialize(key: string): Promise<string> {
    const res = await request(
      app.getHttpServer() as Parameters<typeof request>[0],
    )
      .post('/mcp')
      .set(MCP_HEADERS)
      .set('authorization', `Bearer ${key}`)
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' },
        },
      });
    expect(res.status).toBe(200);
    return res.headers['mcp-session-id'];
  }

  function listTools(key: string, sessionId: string) {
    return request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/mcp')
      .set(MCP_HEADERS)
      .set('authorization', `Bearer ${key}`)
      .set('mcp-session-id', sessionId)
      .set('mcp-protocol-version', '2025-06-18')
      .send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  }

  it('refuses a session opened with another credential', async () => {
    const sessionId = await initialize('k1');

    const res = await listTools('k2', sessionId);

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('Session not found');
  });

  it('refuses to close a session opened with another credential', async () => {
    const sessionId = await initialize('k1');

    const res = await request(
      app.getHttpServer() as Parameters<typeof request>[0],
    )
      .delete('/mcp')
      .set('authorization', 'Bearer k2')
      .set('mcp-session-id', sessionId);

    expect(res.status).toBe(400);
    expect((await listTools('k1', sessionId)).status).toBe(200);
  });

  it('keeps serving the credential that opened the session', async () => {
    const sessionId = await initialize('k1');

    const res = await listTools('k1b', sessionId);

    expect(res.status).toBe(200);
  });
});
