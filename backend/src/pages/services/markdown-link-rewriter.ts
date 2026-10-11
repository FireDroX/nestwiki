import { posix } from 'node:path';

export interface LinkRewriteContext {
  currentFile: string;
  exportedPages: Map<string, string>;
  mediaFiles: Map<string, string>;
  instanceUrl: string;
}

const MARKDOWN_TARGET = /(\]\()([^)\s]+)/g;
const HTML_TARGET = /(\b(?:src|href)=")([^"]+)/g;
const MEDIA_PATH = /^\/api\/media\/([0-9a-f-]{36})\/raw$/i;
const MEDIA_REFERENCE = /\/api\/media\/([0-9a-f-]{36})\/raw/gi;
const PAGE_PATH = /^\/pages(\/[^#?]*)(#.*)?$/;

export class MarkdownLinkRewriter {
  static rewrite(content: string, context: LinkRewriteContext): string {
    const replaceTarget = (_match: string, prefix: string, url: string) =>
      `${prefix}${MarkdownLinkRewriter.rewriteUrl(url, context)}`;
    return content
      .replace(MARKDOWN_TARGET, replaceTarget)
      .replace(HTML_TARGET, replaceTarget);
  }

  static findMediaIds(content: string): string[] {
    return [
      ...new Set(
        [...content.matchAll(MEDIA_REFERENCE)].map((match) =>
          match[1].toLowerCase(),
        ),
      ),
    ];
  }

  private static rewriteUrl(url: string, context: LinkRewriteContext): string {
    const path = MarkdownLinkRewriter.toInstancePath(url, context.instanceUrl);
    if (path === null) {
      return url;
    }

    const media = MEDIA_PATH.exec(path);
    if (media) {
      const file = context.mediaFiles.get(media[1].toLowerCase());
      return file
        ? MarkdownLinkRewriter.relativeTo(context.currentFile, file)
        : `${context.instanceUrl}${path}`;
    }

    const page = PAGE_PATH.exec(path);
    if (page) {
      const pagePath = page[1].replace(/\/+$/, '');
      const anchor = page[2] ?? '';
      const file = context.exportedPages.get(pagePath);
      return file
        ? `${MarkdownLinkRewriter.relativeTo(context.currentFile, file)}${anchor}`
        : `${context.instanceUrl}${path}`;
    }

    return url;
  }

  private static toInstancePath(
    url: string,
    instanceUrl: string,
  ): string | null {
    if (url.startsWith(`${instanceUrl}/`)) {
      return url.slice(instanceUrl.length);
    }
    return url.startsWith('/') && !url.startsWith('//') ? url : null;
  }

  private static relativeTo(currentFile: string, target: string): string {
    return posix.relative(posix.dirname(currentFile), target);
  }
}
