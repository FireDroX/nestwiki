import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return Promise.resolve(true);
    }
    return super.shouldSkip(context);
  }

  protected getTracker(req: Record<string, any>): Promise<string> {
    const request = req as Request;
    const forwardedFor = request.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
      return Promise.resolve(forwardedFor.split(',')[0].trim());
    }
    return Promise.resolve(request.ip ?? 'unknown');
  }
}
