import type { Request } from 'express';
import { DEFAULT_TRUSTED_PROXY_HOPS } from './variables.global.js';

export function resolveClientIp(req: Request): string | undefined {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor !== 'string') {
    return req.ip;
  }
  const entries = forwardedFor
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (entries.length === 0) {
    return req.ip;
  }
  const index = Math.max(entries.length - trustedProxyHops(), 0);
  return entries[index];
}

function trustedProxyHops(): number {
  const hops = Number(process.env.TRUST_PROXY_HOPS);
  return Number.isInteger(hops) && hops > 0 ? hops : DEFAULT_TRUSTED_PROXY_HOPS;
}
