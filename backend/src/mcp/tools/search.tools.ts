import { z } from 'zod';
import { SearchService } from '../../search/services/search.service.js';
import { UsersService } from '../../users/services/users.service.js';
import {
  defineMcpTool,
  McpToolDefinition,
} from '../registry/mcp-tools.registry.js';
import { resolveMcpUser, toAuthenticatedUser } from './mcp-actor.util.js';

const SEARCH_READ_SCOPE = 'search:read';
const PAGES_READ_SCOPE = 'pages:read';
const EXCERPT_MAX_LENGTH = 200;

export function buildSearchTools(
  searchService: SearchService,
  usersService: UsersService,
): McpToolDefinition[] {
  return [
    defineMcpTool({
      name: 'wiki_search',
      description: 'Rechercher des pages existantes par mot-clé',
      inputSchema: {
        query: z.string(),
        limit: z.number().optional(),
      },
      requiredScopes: [SEARCH_READ_SCOPE, PAGES_READ_SCOPE],
      handler: async (input, ctx) => {
        const user = toAuthenticatedUser(
          await resolveMcpUser(usersService, ctx),
        );
        const { items } = await searchService.search(
          { q: input.query, limit: input.limit?.toString() },
          user,
        );
        return {
          results: items.map((item) => ({
            pageId: item.pageId,
            slug: item.slug,
            title: item.title,
            excerpt: item.content.slice(0, EXCERPT_MAX_LENGTH),
          })),
        };
      },
    }),
  ];
}
