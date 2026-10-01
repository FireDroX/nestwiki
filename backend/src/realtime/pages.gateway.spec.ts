import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { PageAccessForbiddenException } from '../common/exceptions/pages/page-access-forbidden.exception.js';
import { PageVersionCreatedEvent } from '../pages/events/page-version-created.event.js';
import type { PagesService } from '../pages/services/pages.service.js';
import { PagesGateway } from './pages.gateway.js';

function buildSocket(cookieHeader?: string) {
  return {
    handshake: { headers: { cookie: cookieHeader } },
    data: {} as Record<string, unknown>,
    disconnect: vi.fn(),
    join: vi.fn().mockResolvedValue(undefined),
    leave: vi.fn().mockResolvedValue(undefined),
  };
}

describe('PagesGateway', () => {
  let gateway: PagesGateway;
  let jwtService: { verifyAsync: ReturnType<typeof vi.fn> };
  let configService: { get: ReturnType<typeof vi.fn> };
  let pagesService: { getByIdOrFail: ReturnType<typeof vi.fn> };
  let emitMock: ReturnType<typeof vi.fn>;
  let server: { to: ReturnType<typeof vi.fn>; emit: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    jwtService = { verifyAsync: vi.fn() };
    configService = { get: vi.fn().mockReturnValue('secret') };
    pagesService = { getByIdOrFail: vi.fn() };
    emitMock = vi.fn();
    server = {
      to: vi.fn().mockReturnValue({ emit: emitMock }),
      emit: vi.fn(),
    };

    gateway = new PagesGateway(
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      pagesService as unknown as PagesService,
    );
    (gateway as unknown as { server: typeof server }).server = server;
  });

  describe('handleConnection', () => {
    it('disconnects a socket whose cookie holds an invalid token', async () => {
      const client = buildSocket('accessToken=bad-token');
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

      await gateway.handleConnection(client as never);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('leaves an anonymous socket connected with no user attached', async () => {
      const client = buildSocket(undefined);

      await gateway.handleConnection(client as never);

      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.data.user).toBeUndefined();
    });

    it('attaches the decoded user to a socket with a valid cookie', async () => {
      const client = buildSocket('foo=bar; accessToken=good-token; other=1');
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        email: 'a@b.com',
        role: 'member',
      });

      await gateway.handleConnection(client as never);

      expect(client.data.user).toEqual({
        id: 'user-1',
        email: 'a@b.com',
        role: 'member',
      });
    });
  });

  describe('handleJoin', () => {
    it('rejects a join when the user cannot read the page', async () => {
      const client = buildSocket();
      client.data.user = { id: 'user-1', email: 'a@b.com', role: 'member' };
      pagesService.getByIdOrFail.mockRejectedValue(
        new PageAccessForbiddenException(),
      );

      const ack = await gateway.handleJoin(client as never, {
        pageId: 'page-1',
      });

      expect(ack).toEqual({ error: 'forbidden' });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('joins the page room when the user can read the page', async () => {
      const client = buildSocket();
      client.data.user = { id: 'user-1', email: 'a@b.com', role: 'member' };
      pagesService.getByIdOrFail.mockResolvedValue({});

      const ack = await gateway.handleJoin(client as never, {
        pageId: 'page-1',
      });

      expect(ack).toEqual({});
      expect(client.join).toHaveBeenCalledWith('page:page-1');
    });
  });

  describe('handlePageVersionCreated', () => {
    it('broadcasts a trimmed payload to the page room', () => {
      const updatedAt = new Date();
      const event = new PageVersionCreatedEvent(
        'page-1',
        'version-2',
        'user-1',
        'Home',
        'content',
        null,
        updatedAt,
      );

      gateway.handlePageVersionCreated(event);

      expect(server.to).toHaveBeenCalledWith('page:page-1');
      expect(emitMock).toHaveBeenCalledWith('page:version-created', {
        pageId: 'page-1',
        versionId: 'version-2',
        authorId: 'user-1',
        updatedAt,
      });
    });
  });

  describe('handlePageTreeChanged', () => {
    it('broadcasts to every connected socket with no room', () => {
      gateway.handlePageTreeChanged();

      expect(server.emit).toHaveBeenCalledWith('page-tree:changed');
    });
  });

  describe('handleCommentChanged', () => {
    it('broadcasts to the page room', () => {
      gateway.handleCommentChanged({ pageId: 'page-1' });

      expect(server.to).toHaveBeenCalledWith('page:page-1');
      expect(emitMock).toHaveBeenCalledWith('comment:changed', {
        pageId: 'page-1',
      });
    });
  });
});
