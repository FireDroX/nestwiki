import { posix } from 'node:path';
import { toHeadingSlug } from '../../common/slug.js';
import { MarkdownLinkRewriter } from '../../pages/services/markdown-link-rewriter.js';

export type ImportResolvedTarget =
  { kind: 'page'; nodeKey: string } | { kind: 'media'; path: string };

export type ImportLinkTarget =
  | { kind: 'page'; nodeKey: string; anchor: string | null }
  | { kind: 'media'; path: string; original: string };

export interface ImportLinkResolver {
  resolvePath(fromFile: string, target: string): ImportResolvedTarget | null;
  resolveName(fromFile: string, name: string): ImportResolvedTarget | null;
}

export interface ImportLinkUrls {
  pagePath(nodeKey: string): string;
  mediaUrl(path: string, original: string): string;
}

export interface ConvertedMarkdown {
  body: string;
  links: ImportLinkTarget[];
  unresolved: string[];
  inlineTags: string[];
  usesWikilinks: boolean;
}

const TOKEN_START = String.fromCharCode(0xe000);
const TOKEN_END = String.fromCharCode(0xe001);
const TOKEN = new RegExp(`${TOKEN_START}([0-9]+)${TOKEN_END}`, 'g');
const TOKEN_CHARACTERS = new RegExp(`[${TOKEN_START}${TOKEN_END}]`, 'g');
const OBSIDIAN_COMMENT = /%%[\s\S]*?%%/g;
const MARKDOWN_LINK_TARGETS = [
  /(\]\()(<[^>\n]+>|[^)\s<>]+)/g,
  /(\b(?:src|href)\s*=\s*["'])([^"']+)/g,
  /^( {0,3}\[(?!\^)[^\]\n]+\]:[ \t]*)(<[^>\n]+>|[^\s<>]+)/gm,
];
const EMBED = /!\[\[([^\]\n]+?)\]\]/g;
const WIKILINK = /(?<!!)\[\[([^\]\n]+?)\]\]/g;
const HIGHLIGHT = /==(?=\S)([^=\n]+?)(?<=\S)==/g;
const HEADING_LINE = /^ {0,3}#{1,6}(?:\s|$)/;
const INLINE_TAG = /(?:^|\s)#([\p{L}\p{N}_/-]+)/gu;
const CSS = /<style\b[\s\S]*?<\/style>|\bstyle\s*=\s*("[^"]*"|'[^']*')/gi;
const EXTERNAL_URL = /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i;
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const IMAGE_SIZE = /^(\d+)(?:x(\d+))?$/;

export class ImportMarkdownConverter {
  static convert(
    markdown: string,
    sourcePath: string,
    resolver: ImportLinkResolver,
  ): ConvertedMarkdown {
    const links: ImportLinkTarget[] = [];
    const unresolved: string[] = [];
    const inlineTags = new Set<string>();
    let usesWikilinks = false;

    const tokenFor = (target: ImportLinkTarget): string => {
      links.push(target);
      return `${TOKEN_START}${links.length - 1}${TOKEN_END}`;
    };
    const linkTo = (
      target: ImportResolvedTarget,
      anchor: string | null,
      original = target.kind === 'media' ? encodeURI(target.path) : '',
    ): ImportLinkTarget =>
      target.kind === 'page' ? { ...target, anchor } : { ...target, original };

    const convertMarkdownLink = (url: string): string => {
      const raw = url.startsWith('<') ? url.slice(1, -1) : url;
      if (EXTERNAL_URL.test(raw)) {
        return url;
      }
      const [pathAndQuery, ...anchorParts] = raw.split('#');
      const path = ImportMarkdownConverter.decode(pathAndQuery.split('?')[0]);
      if (!path) {
        return url;
      }
      const target = resolver.resolvePath(sourcePath, path);
      if (!target) {
        unresolved.push(path);
        return url;
      }
      const anchor = ImportMarkdownConverter.decode(anchorParts.join('#'));
      return tokenFor(linkTo(target, anchor || null, url));
    };

    const convertEmbed = (match: string, inner: string): string => {
      usesWikilinks = true;
      const [targetPart, ...options] =
        ImportMarkdownConverter.splitPipes(inner);
      const { name, anchor } = ImportMarkdownConverter.splitAnchor(targetPart);
      const target = name ? resolver.resolveName(sourcePath, name) : null;
      if (!target) {
        unresolved.push(name || inner);
        return match;
      }
      const label = options.join('|').trim();
      if (
        target.kind === 'media' &&
        IMAGE_EXTENSIONS.includes(posix.extname(target.path).toLowerCase())
      ) {
        const size = IMAGE_SIZE.exec(label);
        const alt = size || !label ? posix.basename(name) : label;
        if (size) {
          const height = size[2] ? ` height="${size[2]}"` : '';
          return `<img src="${tokenFor(linkTo(target, null))}" alt="${ImportMarkdownConverter.escapeAttribute(alt)}" width="${size[1]}"${height}>`;
        }
        return `![${alt}](${tokenFor(linkTo(target, null))})`;
      }
      return `[${label || ImportMarkdownConverter.displayName(name, anchor)}](${tokenFor(linkTo(target, anchor))})`;
    };

    const convertWikilink = (match: string, inner: string): string => {
      usesWikilinks = true;
      const [targetPart, ...aliasParts] =
        ImportMarkdownConverter.splitPipes(inner);
      const alias = aliasParts.join('|').trim();
      const { name, anchor } = ImportMarkdownConverter.splitAnchor(targetPart);
      if (!name) {
        return anchor
          ? `[${alias || anchor}](#${toHeadingSlug(anchor)})`
          : match;
      }
      const target = resolver.resolveName(sourcePath, name);
      if (!target) {
        unresolved.push(name);
        return match;
      }
      return `[${alias || ImportMarkdownConverter.displayName(name, anchor)}](${tokenFor(linkTo(target, anchor))})`;
    };

    const body = MarkdownLinkRewriter.mapOutsideCode(
      markdown.replace(TOKEN_CHARACTERS, ''),
      (text) => {
        const visible = text.replace(OBSIDIAN_COMMENT, '');
        ImportMarkdownConverter.collectInlineTags(visible, inlineTags);
        const withMarkdownLinks = MARKDOWN_LINK_TARGETS.reduce(
          (current, pattern) =>
            current.replace(
              pattern,
              (_match: string, prefix: string, url: string) =>
                `${prefix}${convertMarkdownLink(url)}`,
            ),
          visible,
        );
        return withMarkdownLinks
          .replace(EMBED, convertEmbed)
          .replace(WIKILINK, convertWikilink)
          .replace(HIGHLIGHT, '<mark>$1</mark>');
      },
    );

    return {
      body,
      links,
      unresolved,
      inlineTags: [...inlineTags],
      usesWikilinks,
    };
  }

  static render(
    body: string,
    links: ImportLinkTarget[],
    urls: ImportLinkUrls,
  ): string {
    return body.replace(TOKEN, (_match: string, index: string) => {
      const link = links[Number(index)];
      if (link.kind === 'media') {
        return urls.mediaUrl(link.path, link.original);
      }
      const anchor = link.anchor ? `#${toHeadingSlug(link.anchor)}` : '';
      return `/pages${urls.pagePath(link.nodeKey)}${anchor}`;
    });
  }

  private static collectInlineTags(text: string, tags: Set<string>): void {
    for (const line of text.replace(CSS, '').split('\n')) {
      if (HEADING_LINE.test(line)) {
        continue;
      }
      for (const [, tag] of line.matchAll(INLINE_TAG)) {
        const name = tag.replace(/\/+$/, '');
        if (name && !/^\d+$/.test(name)) {
          tags.add(name);
        }
      }
    }
  }

  private static splitPipes(inner: string): string[] {
    return inner.replace(/\\\|/g, '|').split('|');
  }

  private static splitAnchor(target: string): {
    name: string;
    anchor: string | null;
  } {
    const [name, ...anchors] = target.trim().split('#');
    const anchor = anchors.at(-1)?.trim() ?? '';
    return {
      name: name.trim(),
      anchor: anchor && !anchor.startsWith('^') ? anchor : null,
    };
  }

  private static displayName(name: string, anchor: string | null): string {
    return anchor ? `${name} > ${anchor}` : name;
  }

  private static decode(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  private static escapeAttribute(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }
}
