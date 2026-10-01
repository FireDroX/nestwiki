import { z } from 'zod';
import { GLOBAL_PERMISSIONS, PAGE_ACTIONS } from '../../common/permissions.js';
import { PAGE_ACCESS_RULE_SCOPES } from '../../permissions/entities/page-access-rule.entity.js';
import { AccessRulesService } from '../../permissions/services/access-rules.service.js';
import { GroupsService } from '../../permissions/services/groups.service.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import { USER_ROLES } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import {
  defineMcpTool,
  McpToolDefinition,
} from '../registry/mcp-tools.registry.js';
import { requireGlobalPermission, resolveMcpUser } from './mcp-actor.util.js';

const USERS_READ_SCOPE = 'users:read';
const USERS_WRITE_SCOPE = 'users:write';

const subjectSchema = z.object({
  type: z.enum(['user', 'group']),
  id: z.string(),
});

export function buildUsersTools(
  usersService: UsersService,
  permissionsService: PermissionsService,
  accessRulesService: AccessRulesService,
  groupsService: GroupsService,
): McpToolDefinition[] {
  return [
    defineMcpTool({
      name: 'wiki_create_user',
      description:
        "Créer un compte utilisateur avec un mot de passe temporaire (jamais renvoyé, l'utilisateur devra réinitialiser son mot de passe)",
      inputSchema: {
        email: z.string(),
        displayName: z.string(),
        role: z.enum(USER_ROLES),
      },
      requiredScopes: [USERS_WRITE_SCOPE],
      hideWithoutScope: true,
      handler: async (input, ctx) => {
        const actor = await resolveMcpUser(usersService, ctx);
        await requireGlobalPermission(permissionsService, actor, 'user.manage');

        const { user } = await usersService.createByAdmin(actor, {
          email: input.email,
          displayName: input.displayName,
          role: input.role,
        });

        return {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        };
      },
    }),
    defineMcpTool({
      name: 'wiki_list_users',
      description: 'Lister les utilisateurs (paginé)',
      inputSchema: {
        page: z.number().optional(),
        limit: z.number().optional(),
      },
      requiredScopes: [USERS_READ_SCOPE],
      hideWithoutScope: true,
      handler: async (input, ctx) => {
        const actor = await resolveMcpUser(usersService, ctx);
        await requireGlobalPermission(permissionsService, actor, 'user.manage');

        const { items, total } = await usersService.findAllFilteredPaginated({
          page: input.page?.toString(),
          limit: input.limit?.toString(),
        });
        return {
          items: items.map(({ user }) => ({
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            isActive: user.isActive,
          })),
          total,
        };
      },
    }),
    defineMcpTool({
      name: 'wiki_update_user_role',
      description: "Modifier le rôle d'un utilisateur",
      inputSchema: { userId: z.string(), role: z.enum(USER_ROLES) },
      requiredScopes: [USERS_WRITE_SCOPE],
      hideWithoutScope: true,
      handler: async (input, ctx) => {
        const actor = await resolveMcpUser(usersService, ctx);
        await requireGlobalPermission(permissionsService, actor, 'user.manage');

        const user = await usersService.adminUpdate(actor, input.userId, {
          role: input.role,
        });
        return { id: user.id, role: user.role };
      },
    }),
    defineMcpTool({
      name: 'wiki_list_groups',
      description: 'Lister les groupes (avec nombre de membres et de règles)',
      inputSchema: {},
      requiredScopes: [USERS_READ_SCOPE],
      hideWithoutScope: true,
      handler: async (_input, ctx) => {
        const actor = await resolveMcpUser(usersService, ctx);
        await requireGlobalPermission(permissionsService, actor, 'user.manage');

        const summaries = await groupsService.list();
        return summaries.map(({ group, memberCount, ruleCount }) => ({
          id: group.id,
          name: group.name,
          description: group.description,
          memberCount,
          ruleCount,
        }));
      },
    }),
    defineMcpTool({
      name: 'wiki_set_user_groups',
      description: "Remplacer la liste des groupes d'un utilisateur",
      inputSchema: { userId: z.string(), groupIds: z.array(z.string()) },
      requiredScopes: [USERS_WRITE_SCOPE],
      hideWithoutScope: true,
      handler: async (input, ctx) => {
        const actor = await resolveMcpUser(usersService, ctx);
        await requireGlobalPermission(permissionsService, actor, 'user.manage');

        await usersService.setGroups(actor, input.userId, input.groupIds);
        return { success: true };
      },
    }),
    defineMcpTool({
      name: 'wiki_grant_access',
      description:
        "Accorder une règle d'accès à une page (ou à toute la wiki) à un utilisateur ou un groupe",
      inputSchema: {
        subject: subjectSchema,
        pageId: z.string().nullable(),
        appliesTo: z.enum(PAGE_ACCESS_RULE_SCOPES),
        actions: z.array(z.enum(PAGE_ACTIONS)),
        excludedPageIds: z.array(z.string()).optional(),
      },
      requiredScopes: [USERS_WRITE_SCOPE],
      hideWithoutScope: true,
      handler: async (input, ctx) => {
        const actor = await resolveMcpUser(usersService, ctx);
        await requireGlobalPermission(permissionsService, actor, 'user.manage');

        const rule = await accessRulesService.createAccessRule(
          input.subject,
          {
            pageId: input.pageId,
            appliesTo: input.appliesTo,
            actions: input.actions,
            excludedPageIds: input.excludedPageIds,
          },
          actor.id,
        );
        return rule;
      },
    }),
    defineMcpTool({
      name: 'wiki_set_permissions',
      description:
        'Remplacer les permissions globales directes d’un utilisateur ou d’un groupe',
      inputSchema: {
        subject: subjectSchema,
        permissions: z.array(z.enum(GLOBAL_PERMISSIONS)),
      },
      requiredScopes: [USERS_WRITE_SCOPE],
      hideWithoutScope: true,
      handler: async (input, ctx) => {
        const actor = await resolveMcpUser(usersService, ctx);
        await requireGlobalPermission(permissionsService, actor, 'user.manage');

        await accessRulesService.setGlobalPermissions(
          input.subject,
          input.permissions,
          actor.id,
        );
        return { success: true };
      },
    }),
  ];
}
