import { z } from 'zod';
import { TagNotFoundException } from '../../common/exceptions/tags/tag-not-found.exception.js';
import { TagsService } from '../../tags/services/tags.service.js';
import {
  defineMcpTool,
  McpToolDefinition,
} from '../registry/mcp-tools.registry.js';
import { asFullAccessUser } from './full-access-user.util.js';

const TAGS_READ_SCOPE = 'tags:read';
const TAGS_WRITE_SCOPE = 'tags:write';

export function buildTagsTools(tagsService: TagsService): McpToolDefinition[] {
  return [
    defineMcpTool({
      name: 'wiki_create_tag',
      description: 'Créer un tag',
      inputSchema: {
        name: z.string(),
        color: z
          .string()
          .describe('Couleur hexadécimale du tag (ex. #3b82f6)')
          .optional(),
      },
      requiredScopes: [TAGS_WRITE_SCOPE],
      handler: async (input) => {
        const tag = await tagsService.createTag({
          name: input.name,
          color: input.color,
        });
        return { id: tag.id, name: tag.name, color: tag.color };
      },
    }),
    defineMcpTool({
      name: 'wiki_list_tags',
      description: 'Lister tous les tags',
      inputSchema: {},
      requiredScopes: [TAGS_READ_SCOPE],
      handler: async () => {
        const tags = await tagsService.listTags();
        return tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
        }));
      },
    }),
    defineMcpTool({
      name: 'wiki_tag_page',
      description: 'Associer un tag existant à une page',
      inputSchema: { pageId: z.string(), tagId: z.string() },
      requiredScopes: [TAGS_WRITE_SCOPE],
      handler: async (input, ctx) => {
        try {
          await tagsService.tagPage(
            input.pageId,
            input.tagId,
            asFullAccessUser(ctx),
          );
        } catch (error) {
          if (error instanceof TagNotFoundException) {
            throw new Error(
              'Tag not found — create it first with wiki_create_tag',
              { cause: error },
            );
          }
          throw error;
        }
        return { success: true };
      },
    }),
    defineMcpTool({
      name: 'wiki_untag_page',
      description: "Retirer un tag d'une page",
      inputSchema: { pageId: z.string(), tagId: z.string() },
      requiredScopes: [TAGS_WRITE_SCOPE],
      handler: async (input, ctx) => {
        await tagsService.untagPage(
          input.pageId,
          input.tagId,
          asFullAccessUser(ctx),
        );
        return { success: true };
      },
    }),
    defineMcpTool({
      name: 'wiki_delete_tag',
      description: 'Supprimer un tag (cascade sur les pages liées)',
      inputSchema: { tagId: z.string() },
      requiredScopes: [TAGS_WRITE_SCOPE],
      handler: async (input) => {
        await tagsService.deleteTag(input.tagId);
        return { success: true };
      },
    }),
  ];
}
