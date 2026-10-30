import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import {
  COMMENT_CHANGED_EVENT,
  type CommentChangedEvent,
} from '../comments/events/comment-changed.event.js';
import { SessionUserResolver } from '../common/services/session-user.resolver.js';
import { ACCESS_TOKEN_COOKIE } from '../common/variables.global.js';
import type { AuthenticatedUser } from '../common/strategies/jwt.strategy.js';
import { PAGE_TREE_CHANGED_EVENT } from '../pages/events/page-tree-changed.event.js';
import {
  PAGE_VERSION_CREATED_EVENT,
  PageVersionCreatedEvent,
} from '../pages/events/page-version-created.event.js';
import { PagesService } from '../pages/services/pages.service.js';

interface AuthenticatedSocketData {
  user?: AuthenticatedUser;
}

type AuthenticatedSocket = Socket<
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>,
  AuthenticatedSocketData
>;

interface RoomSocket {
  id: string;
  data: AuthenticatedSocketData;
  emit(event: string, payload: unknown): unknown;
  leave(room: string): unknown;
}

@Injectable()
@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
})
export class PagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server: Server;

  private readonly sessionExpiryTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  constructor(
    private readonly sessionUserResolver: SessionUserResolver,
    private readonly pagesService: PagesService,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token = PagesGateway.extractAccessToken(
      client.handshake.headers.cookie,
    );
    if (!token) {
      return;
    }

    const session = await this.sessionUserResolver.verify(token);
    if (!session) {
      client.disconnect();
      return;
    }
    client.data.user = session.user;
    if (session.expiresAt !== null) {
      this.disconnectAtExpiry(client, session.expiresAt);
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    const timer = this.sessionExpiryTimers.get(client.id);
    if (timer) {
      clearTimeout(timer);
      this.sessionExpiryTimers.delete(client.id);
    }
  }

  @SubscribeMessage('page:join')
  async handleJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { pageId: string },
  ): Promise<{ error?: string }> {
    if (!(await this.canRead(body.pageId, client.data.user))) {
      return { error: 'forbidden' };
    }
    await client.join(PagesGateway.roomOf(body.pageId));
    return {};
  }

  @SubscribeMessage('page:leave')
  handleLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { pageId: string },
  ): void {
    void client.leave(PagesGateway.roomOf(body.pageId));
  }

  @OnEvent(PAGE_VERSION_CREATED_EVENT)
  async handlePageVersionCreated(
    event: PageVersionCreatedEvent,
  ): Promise<void> {
    await this.emitToReaders(event.pageId, 'page:version-created', {
      pageId: event.pageId,
      versionId: event.versionId,
      authorId: event.authorId,
      updatedAt: event.updatedAt,
    });
  }

  @OnEvent(PAGE_TREE_CHANGED_EVENT)
  handlePageTreeChanged(): void {
    this.server.emit('page-tree:changed');
  }

  @OnEvent(COMMENT_CHANGED_EVENT)
  async handleCommentChanged(event: CommentChangedEvent): Promise<void> {
    await this.emitToReaders(event.pageId, 'comment:changed', event);
  }

  private async emitToReaders(
    pageId: string,
    eventName: string,
    payload: unknown,
  ): Promise<void> {
    const room = PagesGateway.roomOf(pageId);
    const sockets = (await this.server
      .in(room)
      .fetchSockets()) as unknown as RoomSocket[];
    await Promise.all(
      sockets.map(async (socket) => {
        if (await this.canRead(pageId, socket.data.user)) {
          socket.emit(eventName, payload);
        } else {
          socket.leave(room);
        }
      }),
    );
  }

  private async canRead(
    pageId: string,
    user: AuthenticatedUser | undefined,
  ): Promise<boolean> {
    try {
      await this.pagesService.getByIdOrFail(pageId, user);
      return true;
    } catch {
      return false;
    }
  }

  private disconnectAtExpiry(
    client: AuthenticatedSocket,
    expiresAt: number,
  ): void {
    const timer = setTimeout(
      () => {
        this.sessionExpiryTimers.delete(client.id);
        client.disconnect();
      },
      Math.max(expiresAt - Date.now(), 0),
    );
    timer.unref?.();
    this.sessionExpiryTimers.set(client.id, timer);
  }

  private static roomOf(pageId: string): string {
    return `page:${pageId}`;
  }

  private static extractAccessToken(cookieHeader?: string): string | null {
    if (!cookieHeader) {
      return null;
    }
    const match = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${ACCESS_TOKEN_COOKIE}=`));
    return match
      ? decodeURIComponent(match.slice(ACCESS_TOKEN_COOKIE.length + 1))
      : null;
  }
}
