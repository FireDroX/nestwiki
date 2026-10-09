import { Test } from '@nestjs/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaService } from '../../media/services/media.service.js';
import { PagesService } from '../../pages/services/pages.service.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import { UsersService } from '../../users/services/users.service.js';
import {
  FORMATTING_GUIDE_TOOL_NAME,
  PAGE_FORMATTING_GUIDE,
} from '../constants/page-formatting.guide.js';
import { McpAuditInterceptor } from '../interceptors/mcp-audit.interceptor.js';
import { McpToolsRegistry } from '../registry/mcp-tools.registry.js';
import { buildMediaTools } from '../tools/media.tools.js';
import { buildPagesTools } from '../tools/pages.tools.js';
import { McpServerService } from './mcp-server.service.js';

const PUBLIC_BASE_URL = 'https://wiki.example.com';

describe('McpServerService', () => {
  let service: McpServerService;
  let registry: McpToolsRegistry;
  let uploadFile: ReturnType<typeof vi.fn>;
  let getPresignedUrl: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    uploadFile = vi.fn().mockResolvedValue({
      attachment: { id: 'media-1', filename: 'schema.png' },
      url: 'https://storage.example/presigned?X-Amz-Expires=900',
    });
    getPresignedUrl = vi.fn().mockResolvedValue({
      url: 'https://storage.example/presigned?X-Amz-Expires=900',
      expiresIn: 900,
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        McpServerService,
        McpToolsRegistry,
        {
          provide: McpAuditInterceptor,
          useValue: {
            wrap: (
              _apiKeyId: string,
              _name: string,
              _args: unknown,
              run: () => Promise<unknown>,
            ) => run(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(McpServerService);
    registry = moduleRef.get(McpToolsRegistry);
    registry.register(
      ...buildPagesTools({} as PagesService, {} as UsersService),
      ...buildMediaTools(
        { uploadFile, getPresignedUrl } as unknown as MediaService,
        {
          findById: vi.fn().mockResolvedValue({ id: 'user-1', role: 'admin' }),
        } as unknown as UsersService,
        {
          hasGlobal: vi.fn().mockResolvedValue(true),
        } as unknown as PermissionsService,
      ),
    );
  });

  async function connect(scopes: string[]): Promise<Client> {
    const server = service.createServer(
      { apiKeyId: 'key-1', scopes, createdById: 'user-1' },
      PUBLIC_BASE_URL,
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(clientTransport);
    return client;
  }

  it('sends the page formatting guide as server instructions', async () => {
    const client = await connect([]);
    expect(client.getInstructions()).toBe(PAGE_FORMATTING_GUIDE);
  });

  it('exposes the formatting guide tool without any scope', async () => {
    const client = await connect([]);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toContain(
      FORMATTING_GUIDE_TOOL_NAME,
    );

    const result = await client.callTool({
      name: FORMATTING_GUIDE_TOOL_NAME,
      arguments: {},
    });
    const [content] = result.content as { type: string; text: string }[];
    expect(JSON.parse(content.text)).toEqual({ guide: PAGE_FORMATTING_GUIDE });
  });

  it('points the page writing tools to the formatting guide', async () => {
    const client = await connect(['pages:write']);
    const { tools } = await client.listTools();
    for (const name of ['wiki_create_page', 'wiki_update_page']) {
      expect(tools.find((tool) => tool.name === name)?.description).toContain(
        FORMATTING_GUIDE_TOOL_NAME,
      );
    }
  });

  it('returns only a permanent, absolute embedUrl when uploading an image', async () => {
    const client = await connect(['media:write']);
    const result = await client.callTool({
      name: 'wiki_upload_image',
      arguments: {
        filename: 'schema.png',
        mimeType: 'image/png',
        contentBase64: 'aGVsbG8=',
      },
    });
    const [content] = result.content as { type: string; text: string }[];
    expect(JSON.parse(content.text)).toEqual({
      id: 'media-1',
      embedUrl: 'https://wiki.example.com/api/media/media-1/raw',
      filename: 'schema.png',
    });
  });

  it('returns the permanent embedUrl alongside the presigned url of a media', async () => {
    const client = await connect(['media:read']);
    const result = await client.callTool({
      name: 'wiki_get_media_url',
      arguments: { attachmentId: 'media-1' },
    });
    const [content] = result.content as { type: string; text: string }[];
    expect(JSON.parse(content.text)).toEqual({
      url: 'https://storage.example/presigned?X-Amz-Expires=900',
      expiresIn: 900,
      embedUrl: 'https://wiki.example.com/api/media/media-1/raw',
    });
  });
});
