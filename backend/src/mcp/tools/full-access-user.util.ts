import type { AuthenticatedUser } from '../../common/strategies/jwt.strategy.js';
import type { McpToolContext } from '../registry/mcp-tools.registry.js';

export function asFullAccessUser(ctx: McpToolContext): AuthenticatedUser {
  return { id: ctx.userId, email: '', role: 'admin' };
}
