import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { resolveClientIp } from '../client-ip.js';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return Promise.resolve(true);
    }
    return super.shouldSkip(context);
  }

  protected getTracker(req: Record<string, any>): Promise<string> {
    return Promise.resolve(resolveClientIp(req as Request) ?? 'unknown');
  }
}
