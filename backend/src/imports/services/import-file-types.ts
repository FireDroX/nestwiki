import { posix } from 'node:path';
import { ATTACHMENT_MIME_TYPES_BY_EXTENSION } from '../../common/variables.global.js';

export const MARKDOWN_EXTENSIONS = ['.md', '.markdown'];

export function isMarkdownFile(path: string): boolean {
  return MARKDOWN_EXTENSIONS.includes(posix.extname(path).toLowerCase());
}

export function attachmentMimeType(path: string): string | undefined {
  const extension = posix.extname(path).slice(1).toLowerCase();
  return Object.hasOwn(ATTACHMENT_MIME_TYPES_BY_EXTENSION, extension)
    ? ATTACHMENT_MIME_TYPES_BY_EXTENSION[extension]
    : undefined;
}
