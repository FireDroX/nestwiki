import { Injectable, OnModuleInit } from '@nestjs/common';
import type { z, ZodRawShape } from 'zod';
import { MediaService } from '../../media/services/media.service.js';
import { PagesService } from '../../pages/services/pages.service.js';
import { AccessRulesService } from '../../permissions/services/access-rules.service.js';
import { GroupsService } from '../../permissions/services/groups.service.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import { SearchService } from '../../search/services/search.service.js';
import { TagsService } from '../../tags/services/tags.service.js';
import { UsersService } from '../../users/services/users.service.js';
import { buildMediaTools } from '../tools/media.tools.js';
import { buildPagesTools } from '../tools/pages.tools.js';
import { buildSearchTools } from '../tools/search.tools.js';
import { buildTagsTools } from '../tools/tags.tools.js';
import { buildUsersTools } from '../tools/users.tools.js';

export interface McpToolContext {
  scopes: string[];
  userId: string;
  publicBaseUrl: string;
}

export type InferShape<S extends ZodRawShape> = {
  [K in keyof S]: z.infer<S[K]>;
};

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: ZodRawShape;
  requiredScopes: string[];
  hideWithoutScope?: boolean;
  handler: (
    input: Record<string, unknown>,
    ctx: McpToolContext,
  ) => Promise<unknown>;
}

export function defineMcpTool<S extends ZodRawShape>(definition: {
  name: string;
  description: string;
  inputSchema: S;
  requiredScopes: string[];
  hideWithoutScope?: boolean;
  handler: (input: InferShape<S>, ctx: McpToolContext) => Promise<unknown>;
}): McpToolDefinition {
  return definition as unknown as McpToolDefinition;
}

@Injectable()
export class McpToolsRegistry {
  private readonly tools: McpToolDefinition[] = [];

  register(...tools: McpToolDefinition[]): void {
    this.tools.push(...tools);
  }

  getAll(): McpToolDefinition[] {
    return this.tools;
  }

  findByName(name: string): McpToolDefinition | undefined {
    return this.tools.find((tool) => tool.name === name);
  }

  getVisibleForScopes(scopes: string[]): McpToolDefinition[] {
    return this.tools.filter(
      (tool) =>
        !tool.hideWithoutScope ||
        tool.requiredScopes.some((scope) => scopes.includes(scope)),
    );
  }
}

@Injectable()
export class McpToolsBootstrapService implements OnModuleInit {
  constructor(
    private readonly registry: McpToolsRegistry,
    private readonly pagesService: PagesService,
    private readonly tagsService: TagsService,
    private readonly usersService: UsersService,
    private readonly mediaService: MediaService,
    private readonly searchService: SearchService,
    private readonly permissionsService: PermissionsService,
    private readonly accessRulesService: AccessRulesService,
    private readonly groupsService: GroupsService,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      ...buildPagesTools(this.pagesService, this.usersService),
      ...buildTagsTools(
        this.tagsService,
        this.usersService,
        this.permissionsService,
      ),
      ...buildUsersTools(
        this.usersService,
        this.permissionsService,
        this.accessRulesService,
        this.groupsService,
      ),
      ...buildMediaTools(
        this.mediaService,
        this.usersService,
        this.permissionsService,
      ),
      ...buildSearchTools(this.searchService, this.usersService),
    );
  }
}
