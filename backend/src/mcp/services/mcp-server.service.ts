import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { InsufficientScopeException } from '../../common/exceptions/mcp/insufficient-scope.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import { McpAuditInterceptor } from '../interceptors/mcp-audit.interceptor.js';
import {
  McpToolDefinition,
  McpToolsRegistry,
} from '../registry/mcp-tools.registry.js';
import type { McpAuthContext } from './api-keys.service.js';
import { PAGE_FORMATTING_GUIDE } from '../constants/page-formatting.guide.js';

const SERVER_NAME = 'nestwiki-mcp';
const SERVER_VERSION = '1.0.0';

@Injectable()
export class McpServerService {
  constructor(
    private readonly toolsRegistry: McpToolsRegistry,
    private readonly auditInterceptor: McpAuditInterceptor,
  ) {}

  createServer(auth: McpAuthContext, publicBaseUrl: string): McpServer {
    const server = new McpServer(
      { name: SERVER_NAME, version: SERVER_VERSION },
      { instructions: PAGE_FORMATTING_GUIDE },
    );

    server.server.registerCapabilities({ tools: {} });

    server.server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: this.toolsRegistry
        .getVisibleForScopes(auth.scopes)
        .map((tool) => McpServerService.toMcpTool(tool)),
    }));

    server.server.setRequestHandler(CallToolRequestSchema, (request) =>
      this.callTool(
        request.params.name,
        (request.params.arguments as Record<string, unknown>) ?? {},
        auth,
        publicBaseUrl,
      ),
    );

    return server;
  }

  private async callTool(
    name: string,
    args: Record<string, unknown>,
    auth: McpAuthContext,
    publicBaseUrl: string,
  ): Promise<CallToolResult> {
    try {
      const output = await this.auditInterceptor.wrap(
        auth.apiKeyId,
        name,
        args,
        () => this.executeTool(name, args, auth, publicBaseUrl),
      );
      return { content: [{ type: 'text', text: JSON.stringify(output) }] };
    } catch (error) {
      return McpServerService.errorResult(
        error instanceof Error ? error.message : 'Unexpected error',
      );
    }
  }

  private async executeTool(
    name: string,
    args: Record<string, unknown>,
    auth: McpAuthContext,
    publicBaseUrl: string,
  ): Promise<unknown> {
    const tool = this.toolsRegistry.findByName(name);
    if (!tool) {
      throw new ValidationException(`Unknown tool: ${name}`);
    }

    if (!McpServerService.hasRequiredScope(tool, auth.scopes)) {
      throw new InsufficientScopeException(tool.requiredScopes);
    }

    const parsed = z.object(tool.inputSchema).safeParse(args);
    if (!parsed.success) {
      throw new ValidationException(
        `Invalid input: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`,
      );
    }

    return tool.handler(parsed.data, {
      scopes: auth.scopes,
      userId: auth.createdById,
      publicBaseUrl,
    });
  }

  private static hasRequiredScope(
    tool: McpToolDefinition,
    scopes: string[],
  ): boolean {
    return (
      tool.requiredScopes.length === 0 ||
      tool.requiredScopes.some((scope) => scopes.includes(scope))
    );
  }

  private static toMcpTool(tool: McpToolDefinition): Tool {
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: z.toJSONSchema(z.object(tool.inputSchema), {
        target: 'draft-7',
      }) as Tool['inputSchema'],
    };
  }

  private static errorResult(message: string): CallToolResult {
    return { content: [{ type: 'text', text: message }], isError: true };
  }
}
