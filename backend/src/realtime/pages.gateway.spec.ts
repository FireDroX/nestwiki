import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import { PageAccessForbiddenException } from '../common/exceptions/pages/page-access-forbidden.exception.js';
import type { SessionUserResolver } from '../common/services/session-user.resolver.js';
import type { AuthenticatedUser } from '../common/strategies/jwt.strategy.js';
import { PageVersionCreatedEvent } from '../pages/events/page-version-created.event.js';
import type { PagesService } from '../pages/services/pages.service.js';
import { PagesGateway } from './pages.gateway.js';

const member: AuthenticatedUser = {
  id: 'user-1',
  email: 'a@b.com',
  role: 'member',
};

function buildSocket(cookieHeader?: string) {
  return {
    id: 'socket-1',
    handshake: { headers: { cookie: cookieHeader } },
    data: {} as Record<string, unknown>,
    disconnect: vi.fn(),
    join: vi.fn().mockResolvedValue(undefined),
    leave: vi.fn().mockResolvedValue(undefined),
  };
}

function buildRoomSocket(id: string, user?: AuthenticatedUser) {
  return { id, data: { user }, emit: vi.fn(), leave: vi.fn() };
}

describe('PagesGateway', () => {
  let gateway: PagesGateway;
  let sessionUserResolver: { verify: ReturnType<typeof vi.fn> };
  let pagesService: {
    getByIdOrFail: Mock<
      (pageId: string, user?: AuthenticatedUser) => Promise<unknown>
    >;
  };
  let roomSockets: ReturnType<typeof buildRoomSocket>[];
  let server: { in: ReturnType<typeof vi.fn>; emit: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    sessionUserResolver = { verify: vi.fn() };
    pagesService = { getByIdOrFail: vi.fn().mockResolvedValue({}) };
    roomSockets = [];
    server = {
      in: vi.fn(() => ({
        fetchSockets: vi.fn(() => Promise.resolve(roomSockets)),
      })),
      emit: vi.fn(),
    };

    gateway = new PagesGateway(
      sessionUserResolver as unknown as SessionUserResolver,
      pagesService as unknown as PagesService,
    );
    (gateway as unknown as { server: typeof server }).server = server;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('handleConnection', () => {
    it('disconnects a socket whose cookie holds an invalid session', async () => {
      const client = buildSocket('accessToken=bad-token');
      sessionUserResolver.verify.mockResolvedValue(null);

      await gateway.handleConnection(client as never);

      expect(sessionUserResolver.verify).toHaveBeenCalledWith('bad-token');
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('leaves an anonymous socket connected with no user attached', async () => {
      const client = buildSocket(undefined);

      await gateway.handleConnection(client as never);

      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.data.user).toBeUndefined();
    });

    it('attaches the session user to a socket with a valid cookie', async () => {
      const client = buildSocket('foo=bar; accessToken=good-token; other=1');
      sessionUserResolver.verify.mockResolvedValue({
        user: member,
        expiresAt: null,
      });

      await gateway.handleConnection(client as never);

      expect(sessionUserResolver.verify).toHaveBeenCalledWith('good-token');
      expect(client.data.user).toEqual(member);
    });

    it('disconnects the socket when its session expires', async () => {
      vi.useFakeTimers();
      const client = buildSocket('accessToken=good-token');
      sessionUserResolver.verify.mockResolvedValue({
        user: member,
        expiresAt: Date.now() + 60_000,
      });

      await gateway.handleConnection(client as never);
      vi.advanceTimersByTime(59_000);
      expect(client.disconnect).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1_000);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('forgets the expiry timer of a socket that left', async () => {
      vi.useFakeTimers();
      const client = buildSocket('accessToken=good-token');
      sessionUserResolver.verify.mockResolvedValue({
        user: member,
        expiresAt: Date.now() + 60_000,
      });

      await gateway.handleConnection(client as never);
      gateway.handleDisconnect(client as never);
      vi.advanceTimersByTime(60_000);

      expect(client.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('handleJoin', () => {
    it('rejects a join when the user cannot read the page', async () => {
      const client = buildSocket();
      client.data.user = member;
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
      client.data.user = member;

      const ack = await gateway.handleJoin(client as never, {
        pageId: 'page-1',
      });

      expect(ack).toEqual({});
      expect(client.join).toHaveBeenCalledWith('page:page-1');
    });
  });

  describe('handlePageVersionCreated', () => {
    it('sends a trimmed payload to the readers of the page room', async () => {
      const reader = buildRoomSocket('reader', member);
      roomSockets = [reader];
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

      await gateway.handlePageVersionCreated(event);

      expect(server.in).toHaveBeenCalledWith('page:page-1');
      expect(reader.emit).toHaveBeenCalledWith('page:version-created', {
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
    it('notifies the readers of the page room', async () => {
      const reader = buildRoomSocket('reader', member);
      roomSockets = [reader];

      await gateway.handleCommentChanged({ pageId: 'page-1' });

      expect(reader.emit).toHaveBeenCalledWith('comment:changed', {
        pageId: 'page-1',
      });
    });

    it('drops a socket that lost read access instead of notifying it', async () => {
      const reader = buildRoomSocket('reader', member);
      const revoked = buildRoomSocket('revoked', {
        id: 'user-2',
        email: 'c@d.com',
        role: 'member',
      });
      roomSockets = [reader, revoked];
      pagesService.getByIdOrFail.mockImplementation(
        (_pageId: string, user?: AuthenticatedUser) =>
          user?.id === 'user-2'
            ? Promise.reject(new PageAccessForbiddenException())
            : Promise.resolve({}),
      );

      await gateway.handleCommentChanged({ pageId: 'page-1' });

      expect(reader.emit).toHaveBeenCalled();
      expect(revoked.emit).not.toHaveBeenCalled();
      expect(revoked.leave).toHaveBeenCalledWith('page:page-1');
    });
  });
});
