import { z } from 'zod';
import { PagesService } from '../../pages/services/pages.service.js';
import { PAGE_VISIBILITIES } from '../../pages/entities/page.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import {
  FORMATTING_GUIDE_TOOL_NAME,
  PAGE_CONTENT_SUMMARY,
  PAGE_FORMATTING_GUIDE,
} from '../constants/page-formatting.guide.js';
import {
  defineMcpTool,
  McpToolDefinition,
} from '../registry/mcp-tools.registry.js';
import { resolveMcpUser, toAuthenticatedUser } from './mcp-actor.util.js';

const PAGES_READ_SCOPE = 'pages:read';
const PAGES_WRITE_SCOPE = 'pages:write';

export function buildPagesTools(
  pagesService: PagesService,
  usersService: UsersService,
): McpToolDefinition[] {
  return [
    defineMcpTool({
      name: FORMATTING_GUIDE_TOOL_NAME,
      description:
        'Obtenir le guide complet du formatage supporté dans le contenu des pages (Markdown, encadrés, ancres, LaTeX, Mermaid, HTML/CSS, liens internes, images). À consulter avant de créer ou modifier une page.',
      inputSchema: {},
      requiredScopes: [],
      handler: () => Promise.resolve({ guide: PAGE_FORMATTING_GUIDE }),
    }),
    defineMcpTool({
      name: 'wiki_create_page',
      description: `Créer une nouvelle page dans le wiki. ${PAGE_CONTENT_SUMMARY}`,
      inputSchema: {
        slug: z.string(),
        title: z.string(),
        content: z.string(),
        parentId: z.string().optional(),
        visibility: z.enum(PAGE_VISIBILITIES),
      },
      requiredScopes: [PAGES_WRITE_SCOPE],
      handler: async (input, ctx) => {
        const { page } = await pagesService.createPage(
          {
            slug: input.slug,
            title: input.title,
            content: input.content,
            parentId: input.parentId ?? null,
            visibility: input.visibility,
          },
          ctx.userId,
        );
        return {
          id: page.id,
          slug: page.slug,
          title: page.title,
          url: await pagesService.getAncestorPath(page),
        };
      },
    }),
    defineMcpTool({
      name: 'wiki_update_page',
      description: `Modifier le titre, le contenu ou créer une nouvelle version d'une page existante. ${PAGE_CONTENT_SUMMARY}`,
      inputSchema: {
        pageId: z.string(),
        title: z.string().optional(),
        content: z.string().optional(),
        changeSummary: z.string().optional(),
      },
      requiredScopes: [PAGES_WRITE_SCOPE],
      handler: async (input, ctx) => {
        const { page } = await pagesService.updatePage(
          input.pageId,
          {
            title: input.title,
            content: input.content,
            changeSummary: input.changeSummary,
          },
          ctx.userId,
        );
        return {
          id: page.id,
          currentVersionId: page.currentVersionId,
          updatedAt: page.updatedAt,
        };
      },
    }),
    defineMcpTool({
      name: 'wiki_get_page',
      description:
        'Récupérer une page par son chemin complet (ex. "docs/guide")',
      inputSchema: { slug: z.string() },
      requiredScopes: [PAGES_READ_SCOPE],
      handler: async (input, ctx) => {
        const segments = input.slug.split('/').filter(Boolean);
        const user = toAuthenticatedUser(
          await resolveMcpUser(usersService, ctx),
        );
        const { page, version } = await pagesService.findByPath(segments, user);
        return {
          id: page.id,
          slug: page.slug,
          title: page.title,
          content: version.content,
          visibility: page.visibility,
        };
      },
    }),
    defineMcpTool({
      name: 'wiki_list_pages',
      description:
        "Lister les pages : l'arbre complet si parentId est omis, sinon les enfants directs de parentId",
      inputSchema: { parentId: z.string().optional() },
      requiredScopes: [PAGES_READ_SCOPE],
      handler: async (input, ctx) => {
        const user = toAuthenticatedUser(
          await resolveMcpUser(usersService, ctx),
        );
        if (!input.parentId) {
          return pagesService.getTree(user);
        }
        const children = await pagesService.listChildren(input.parentId, user);
        return children.map((page) => ({
          id: page.id,
          slug: page.slug,
          title: page.title,
        }));
      },
    }),
    defineMcpTool({
      name: 'wiki_delete_page',
      description:
        'Supprimer une page ; cascade obligatoire si elle a des enfants',
      inputSchema: {
        pageId: z.string(),
        cascade: z.boolean().optional(),
      },
      requiredScopes: [PAGES_WRITE_SCOPE],
      handler: async (input, ctx) => {
        await pagesService.deletePage(
          input.pageId,
          { cascade: input.cascade ? 'true' : undefined },
          ctx.userId,
        );
        return { success: true };
      },
    }),
    defineMcpTool({
      name: 'wiki_set_page_visibility',
      description:
        "Changer la visibilité d'une page (public/private), appliquée en cascade aux enfants",
      inputSchema: {
        pageId: z.string(),
        visibility: z.enum(PAGE_VISIBILITIES),
      },
      requiredScopes: [PAGES_WRITE_SCOPE],
      handler: async (input, ctx) => {
        const { page } = await pagesService.setVisibility(
          input.pageId,
          { visibility: input.visibility },
          ctx.userId,
        );
        return { id: page.id, visibility: page.visibility };
      },
    }),
  ];
}
