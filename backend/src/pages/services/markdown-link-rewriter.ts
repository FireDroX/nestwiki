import { posix } from 'node:path';
import {
  PAGE_LINK_TARGET_MAX_LENGTH,
  RESERVED_ROOT_PAGE_SLUGS,
} from '../../common/variables.global.js';

export interface LinkRewriteContext {
  currentFile: string;
  exportedPages: Map<string, string>;
  mediaFiles: Map<string, string>;
  instanceUrl: string;
}

export interface PagePathMove {
  from: string;
  to: string;
}

const LINK_TARGETS = [
  /(\]\(<?)([^)\s>]+)/g,
  /(\b(?:src|href)\s*=\s*["'])([^"']+)/g,
  /^( {0,3}\[[^\]\n]+\]:[ \t]*<?)([^\s>]+)/gm,
];
const MEDIA_PATH = /^\/api\/media\/([0-9a-f-]{36})\/raw(?:\?[^#]*)?$/i;
const PAGE_PATH = /^\/pages(\/[^#?]*)(?:\?[^#]*)?(#.*)?$/;
const PAGE_PATH_AND_SUFFIX = /^\/pages(\/[^#?]*)(.*)$/s;
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

  static movePagePaths(
    content: string,
    move: PagePathMove,
    instanceUrl: string,
  ): { content: string; linksUpdated: number } {
    let linksUpdated = 0;
    const rewritten = MarkdownLinkRewriter.mapOutsideCode(content, (text) =>
      LINK_TARGETS.reduce(
        (current, pattern) =>
          current.replace(
            pattern,
            (match: string, prefix: string, url: string) => {
              const moved = MarkdownLinkRewriter.moveUrl(
                url,
                move,
                instanceUrl,
              );
              if (moved === null) {
                return match;
              }
              linksUpdated += 1;
              return `${prefix}${moved}`;
            },
          ),
        text,
      ),
    );
    return { content: rewritten, linksUpdated };
  }

  static findMediaIds(content: string, instanceUrl: string): string[] {
    const ids = new Set<string>();
    for (const path of MarkdownLinkRewriter.findInstancePaths(
      content,
      instanceUrl,
    )) {
      const media = MEDIA_PATH.exec(path);
      if (media) {
        ids.add(media[1].toLowerCase());
      }
    }
    return [...ids];
  }

  static findPagePaths(content: string, instanceUrl: string): string[] {
    const paths = new Set<string>();
    for (const path of MarkdownLinkRewriter.findInstancePaths(
      content,
      instanceUrl,
    )) {
      const page = PAGE_PATH.exec(path);
      const pagePath = page ? MarkdownLinkRewriter.toPagePath(page[1]) : null;
      if (pagePath) {
        paths.add(pagePath);
      }
    }
    return [...paths];
  }

  private static findInstancePaths(
    content: string,
    instanceUrl: string,
  ): string[] {
    const paths: string[] = [];
    MarkdownLinkRewriter.mapOutsideCode(content, (text) => {
      for (const pattern of LINK_TARGETS) {
        for (const [, , url] of text.matchAll(pattern)) {
          const path = MarkdownLinkRewriter.toInstancePath(url, instanceUrl);
          if (path !== null) {
            paths.push(path);
          }
        }
      }
      return text;
    });
    return paths;
  }

  private static toPagePath(rawPath: string): string | null {
    let path: string;
    try {
      path = decodeURIComponent(rawPath.replace(/\/+$/, '')).toLowerCase();
    } catch {
      return null;
    }
    const [rootSlug] = path.split('/').filter(Boolean);
    if (
      !rootSlug ||
      RESERVED_ROOT_PAGE_SLUGS.includes(rootSlug) ||
      path.length > PAGE_LINK_TARGET_MAX_LENGTH
    ) {
      return null;
    }
    return path;
  }

  static mapOutsideCode(
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

  private static moveUrl(
    url: string,
    move: PagePathMove,
    instanceUrl: string,
  ): string | null {
    const path = MarkdownLinkRewriter.toInstancePath(url, instanceUrl);
    const page = path === null ? null : PAGE_PATH_AND_SUFFIX.exec(path);
    const pagePath = page ? MarkdownLinkRewriter.toPagePath(page[1]) : null;
    const from = move.from.toLowerCase();
    if (
      !page ||
      pagePath === null ||
      (pagePath !== from && !pagePath.startsWith(`${from}/`))
    ) {
      return null;
    }
    const origin = path === url ? '' : instanceUrl;
    const movedSegmentCount = from.split('/').length;
    const rest = page[1].split('/').slice(movedSegmentCount).join('/');
    return `${origin}/pages${move.to}${rest ? `/${rest}` : ''}${page[2]}`;
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
