import { z } from 'zod';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import {
  MediaService,
  UploadedMediaFile,
} from '../../media/services/media.service.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import { UsersService } from '../../users/services/users.service.js';
import {
  defineMcpTool,
  McpToolDefinition,
} from '../registry/mcp-tools.registry.js';
import {
  requireGlobalPermission,
  resolveMcpUser,
  toAuthenticatedUser,
} from './mcp-actor.util.js';

const MEDIA_READ_SCOPE = 'media:read';
const MEDIA_WRITE_SCOPE = 'media:write';
const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;

function decodeBase64OrThrow(content: string): Buffer {
  if (!content || !BASE64_REGEX.test(content)) {
    throw new ValidationException('Invalid base64 content');
  }
  return Buffer.from(content, 'base64');
}

export function buildMediaTools(
  mediaService: MediaService,
  usersService: UsersService,
  permissionsService: PermissionsService,
): McpToolDefinition[] {
  return [
    defineMcpTool({
      name: 'wiki_upload_image',
      description: 'Uploader une image (transmise en base64) sur une page',
      inputSchema: {
        pageId: z.string().optional(),
        filename: z.string(),
        mimeType: z.string(),
        contentBase64: z.string(),
      },
      requiredScopes: [MEDIA_WRITE_SCOPE],
      handler: async (input, ctx) => {
        const user = await resolveMcpUser(usersService, ctx);
        await requireGlobalPermission(permissionsService, user, 'media.upload');

        const buffer = decodeBase64OrThrow(input.contentBase64);
        const file: UploadedMediaFile = {
          originalname: input.filename,
          mimetype: input.mimeType,
          size: buffer.length,
          buffer,
        };

        const { attachment, url } = await mediaService.uploadFile(
          file,
          { pageId: input.pageId },
          ctx.userId,
        );

        return { id: attachment.id, url, filename: attachment.filename };
      },
    }),
    defineMcpTool({
      name: 'wiki_get_media_url',
      description: 'Obtenir une URL présignée pour un média',
      inputSchema: { attachmentId: z.string() },
      requiredScopes: [MEDIA_READ_SCOPE],
      handler: async (input, ctx) => {
        const user = toAuthenticatedUser(
          await resolveMcpUser(usersService, ctx),
        );
        return mediaService.getPresignedUrl(input.attachmentId, user);
      },
    }),
  ];
}
