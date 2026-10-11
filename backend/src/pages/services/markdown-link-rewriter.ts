import { posix } from 'node:path';

export interface LinkRewriteContext {
  currentFile: string;
  exportedPages: Map<string, string>;
  mediaFiles: Map<string, string>;
  instanceUrl: string;
}

const LINK_TARGETS = [
  /(\]\(<?)([^)\s>]+)/g,
  /(\b(?:src|href)\s*=\s*["'])([^"']+)/g,
  /^( {0,3}\[[^\]\n]+\]:[ \t]*<?)([^\s>]+)/gm,
];
const MEDIA_PATH = /^\/api\/media\/([0-9a-f-]{36})\/raw(?:\?[^#]*)?$/i;
const PAGE_PATH = /^\/pages(\/[^#?]*)(?:\?[^#]*)?(#.*)?$/;
const CODE =
  /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^[ \t]*\1[^\n]*$|(?![\s\S]))|(`+)(?!`)(?:(?!\n[ \t]*\n)[\s\S])*?[^`]\2(?!`)/gm;

export class MarkdownLinkRewriter {
  static rewrite(content: string, context: LinkRewriteContext): string {
    return MarkdownLinkRewriter.mapOutsideCode(content, (text) =>
      LINK_TARGETS.reduce(
        (rewritten, pattern) =>
          rewritten.replace(
            pattern,
            (_match: string, prefix: string, url: string) =>
              `${prefix}${MarkdownLinkRewriter.rewriteUrl(url, context)}`,
          ),
        text,
      ),
    );
  }

  static findMediaIds(content: string, instanceUrl: string): string[] {
    const ids = new Set<string>();
    MarkdownLinkRewriter.mapOutsideCode(content, (text) => {
      for (const pattern of LINK_TARGETS) {
        for (const [, , url] of text.matchAll(pattern)) {
          const path = MarkdownLinkRewriter.toInstancePath(url, instanceUrl);
          const media = path === null ? null : MEDIA_PATH.exec(path);
          if (media) {
            ids.add(media[1].toLowerCase());
          }
        }
      }
      return text;
    });
    return [...ids];
  }

  private static mapOutsideCode(
    content: string,
    transform: (text: string) => string,
  ): string {
    let result = '';
    let cursor = 0;
    for (const code of content.matchAll(CODE)) {
      result += transform(content.slice(cursor, code.index));
      result += code[0];
      cursor = code.index + code[0].length;
    }
    return result + transform(content.slice(cursor));
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
