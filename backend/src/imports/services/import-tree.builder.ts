import { posix } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ImportTooLargeException } from '../../common/exceptions/imports/import-too-large.exception.js';
import { InvalidImportArchiveException } from '../../common/exceptions/imports/invalid-import-archive.exception.js';
import {
  IMPORT_MAX_PAGES,
  MAX_ATTACHMENT_SIZE_BYTES,
  TAG_NAME_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from '../../common/variables.global.js';
import { toComparableName } from '../../common/slug.js';
import { MarkdownLinkRewriter } from '../../pages/services/markdown-link-rewriter.js';
import type {
  IgnoredImportFile,
  ImportArchiveContent,
  ImportSourceFile,
} from './import-archive.reader.js';
import {
  attachmentMimeType,
  isMarkdownFile,
  MARKDOWN_EXTENSIONS,
} from './import-file-types.js';
import {
  ImportMarkdownConverter,
  type ImportLinkResolver,
  type ImportLinkTarget,
  type ImportResolvedTarget,
} from './import-markdown.converter.js';

export const IMPORT_FORMATS = ['nestwiki', 'obsidian', 'markdown'] as const;
export type ImportFormat = (typeof IMPORT_FORMATS)[number];

export interface ImportNode {
  key: string;
  parentKey: string | null;
  name: string;
  title: string;
  sourcePath: string | null;
  body: string;
  links: ImportLinkTarget[];
  tags: string[];
}

export interface ImportMediaFile {
  path: string;
  filename: string;
  mimeType: string;
  size: number;
  data: Buffer;
  ownerKey: string;
}

export interface ImportUnresolvedLink {
  nodeKey: string;
  target: string;
}

export interface ImportTree {
  format: ImportFormat;
  nodes: ImportNode[];
  media: ImportMediaFile[];
  ignoredFiles: IgnoredImportFile[];
  unresolvedLinks: ImportUnresolvedLink[];
}

interface ParsedNote {
  path: string;
  markdown: string;
  title: string | null;
  tags: string[];
  aliases: string[];
  hasNestWikiSource: boolean;
}

interface ResolvableEntry {
  path: string;
  names: string[];
  target: ImportResolvedTarget;
}

const FOLDER_NOTE_NAMES = ['index', 'readme'];
const FRONTMATTER = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/;
const LEADING_BLANK_LINES = /^(?:[ \t]*\n)+/;
const FIRST_HEADING = /^# +(.+?)(?:\s+#+)?\s*$/m;
const OBSIDIAN_CONFIG_FOLDER = '.obsidian';
const utf8 = new TextDecoder('utf-8');

export class ImportTreeBuilder {
  static build(archive: ImportArchiveContent): ImportTree {
    const notes = new Map<string, ImportSourceFile>();
    const mediaFiles = new Map<string, ImportSourceFile>();
    const ignoredFiles: IgnoredImportFile[] = [...archive.ignored];
    for (const file of archive.files) {
      const mimeType = attachmentMimeType(file.path);
      if (isMarkdownFile(file.path)) {
        notes.set(file.path, file);
      } else if (!mimeType) {
        ignoredFiles.push({ path: file.path, reason: 'unsupported_type' });
      } else if (file.data.length > MAX_ATTACHMENT_SIZE_BYTES) {
        ignoredFiles.push({ path: file.path, reason: 'too_large' });
      } else {
        mediaFiles.set(file.path, file);
      }
    }
    if (notes.size === 0) {
      throw new InvalidImportArchiveException(
        'The archive does not contain any Markdown file',
      );
    }

    const folderNotes = ImportTreeBuilder.assignFolderNotes([...notes.keys()]);
    const consumedNotes = new Set(folderNotes.values());
    const folders = [...folderNotes.keys()];
    const standaloneNotes = [...notes.keys()].filter(
      (path) => !consumedNotes.has(path),
    );
    if (folders.length + standaloneNotes.length > IMPORT_MAX_PAGES) {
      throw new ImportTooLargeException(
        `The archive must not contain more than ${IMPORT_MAX_PAGES} pages`,
      );
    }

    const parsedNotes = new Map(
      [...notes.values()].map((file) => [
        file.path,
        ImportTreeBuilder.parseNote(file),
      ]),
    );
    const noteKeyByPath = new Map<string, string>();
    for (const [folder, notePath] of folderNotes) {
      if (notePath) {
        noteKeyByPath.set(notePath, ImportTreeBuilder.folderKey(folder));
      }
    }
    for (const path of standaloneNotes) {
      noteKeyByPath.set(path, path);
    }

    const resolver = new ImportArchiveIndex(
      ImportTreeBuilder.resolvableEntries(folders, noteKeyByPath, parsedNotes, [
        ...mediaFiles.keys(),
      ]),
    );

    const unresolvedLinks: ImportUnresolvedLink[] = [];
    let usesWikilinks = false;
    const nodes: ImportNode[] = [];
    const toNode = (
      key: string,
      parentKey: string | null,
      name: string,
      note: ParsedNote | undefined,
    ): ImportNode => {
      const title = (note?.title ?? name).slice(0, TITLE_MAX_LENGTH);
      if (!note) {
        return {
          key,
          parentKey,
          name,
          title,
          sourcePath: null,
          body: `# ${title}`,
          links: [],
          tags: [],
        };
      }
      const converted = ImportMarkdownConverter.convert(
        note.markdown,
        note.path,
        resolver,
      );
      usesWikilinks ||= converted.usesWikilinks;
      unresolvedLinks.push(
        ...converted.unresolved.map((target) => ({ nodeKey: key, target })),
      );
      return {
        key,
        parentKey,
        name,
        title,
        sourcePath: note.path,
        body: ImportTreeBuilder.withTitleHeading(converted.body, title),
        links: converted.links,
        tags: ImportTreeBuilder.uniqueTags([
          ...note.tags,
          ...converted.inlineTags,
        ]),
      };
    };

    for (const folder of folders) {
      const notePath = folderNotes.get(folder) ?? null;
      nodes.push(
        toNode(
          ImportTreeBuilder.folderKey(folder),
          ImportTreeBuilder.parentKeyOf(folder),
          posix.basename(folder),
          notePath ? parsedNotes.get(notePath) : undefined,
        ),
      );
    }
    for (const path of standaloneNotes) {
      nodes.push(
        toNode(
          path,
          ImportTreeBuilder.parentKeyOf(path),
          ImportTreeBuilder.stripExtension(posix.basename(path)),
          parsedNotes.get(path),
        ),
      );
    }

    const orderedNodes = ImportTreeBuilder.orderParentsFirst(nodes);
    const media = ImportTreeBuilder.referencedMedia(
      orderedNodes,
      mediaFiles,
      ignoredFiles,
    );

    return {
      format: ImportTreeBuilder.detectFormat(archive, usesWikilinks, [
        ...parsedNotes.values(),
      ]),
      nodes: orderedNodes,
      media,
      ignoredFiles,
      unresolvedLinks,
    };
  }

  private static assignFolderNotes(
    notePaths: string[],
  ): Map<string, string | null> {
    const notesByLowerPath = new Map(
      notePaths.map((path) => [path.toLowerCase(), path]),
    );
    const folders = new Set<string>();
    for (const path of notePaths) {
      let folder = posix.dirname(path);
      while (folder !== '.') {
        folders.add(folder);
        folder = posix.dirname(folder);
      }
    }

    const consumed = new Set<string>();
    const folderNotes = new Map<string, string | null>();
    const byDepth = [...folders].sort(
      (a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b),
    );
    for (const folder of byDepth) {
      const name = posix.basename(folder);
      const parent = posix.dirname(folder);
      const candidates = [
        `${folder}/${name}`,
        parent === '.' ? name : `${parent}/${name}`,
        ...FOLDER_NOTE_NAMES.map((noteName) => `${folder}/${noteName}`),
      ].flatMap((base) =>
        MARKDOWN_EXTENSIONS.map((extension) =>
          notesByLowerPath.get(`${base}${extension}`.toLowerCase()),
        ),
      );
      const note =
        candidates.find(
          (candidate): candidate is string =>
            candidate !== undefined && !consumed.has(candidate),
        ) ?? null;
      if (note) {
        consumed.add(note);
      }
      folderNotes.set(folder, note);
    }
    return folderNotes;
  }

  private static parseNote(file: ImportSourceFile): ParsedNote {
    const text = utf8.decode(file.data).replace(/\r\n?/g, '\n');
    const frontmatterMatch = FRONTMATTER.exec(text);
    const frontmatter = frontmatterMatch
      ? ImportTreeBuilder.parseFrontmatter(frontmatterMatch[1])
      : {};
    const markdown = (
      frontmatterMatch ? text.slice(frontmatterMatch[0].length) : text
    ).replace(LEADING_BLANK_LINES, '');

    const frontmatterTitle = ImportTreeBuilder.toStrings(frontmatter.title)[0];
    return {
      path: file.path,
      markdown,
      title:
        frontmatterTitle?.trim() ||
        ImportTreeBuilder.firstHeading(markdown) ||
        null,
      tags: ImportTreeBuilder.toStrings(frontmatter.tags, /[,\s]+/),
      aliases: ImportTreeBuilder.toStrings(frontmatter.aliases, /,/),
      hasNestWikiSource: typeof frontmatter.source === 'string',
    };
  }

  private static parseFrontmatter(yaml: string): Record<string, unknown> {
    try {
      const parsed: unknown = parseYaml(yaml);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  private static toStrings(value: unknown, separator?: RegExp): string[] {
    const values = Array.isArray(value)
      ? value
      : typeof value === 'string' && separator
        ? value.split(separator)
        : value === undefined || value === null
          ? []
          : [value];
    return values
      .filter(
        (item): item is string | number =>
          typeof item === 'string' || typeof item === 'number',
      )
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  private static firstHeading(markdown: string): string | null {
    let heading: string | null = null;
    MarkdownLinkRewriter.mapOutsideCode(markdown, (text) => {
      heading ??= FIRST_HEADING.exec(text)?.[1].trim() ?? null;
      return text;
    });
    return heading;
  }

  private static withTitleHeading(body: string, title: string): string {
    return body.startsWith('# ') ? body : `# ${title}\n\n${body}`.trimEnd();
  }

  private static uniqueTags(tags: string[]): string[] {
    const byLowerName = new Map<string, string>();
    for (const tag of tags) {
      const name = tag.replace(/^#+/, '').trim();
      if (
        name &&
        name.length <= TAG_NAME_MAX_LENGTH &&
        !byLowerName.has(toComparableName(name))
      ) {
        byLowerName.set(toComparableName(name), name);
      }
    }
    return [...byLowerName.values()];
  }

  private static resolvableEntries(
    folders: string[],
    noteKeyByPath: Map<string, string>,
    parsedNotes: Map<string, ParsedNote>,
    mediaPaths: string[],
  ): ResolvableEntry[] {
    const noteEntries = [...noteKeyByPath].map(([path, nodeKey]) => {
      const filename = posix.basename(path);
      return {
        path,
        names: [
          filename,
          ImportTreeBuilder.stripExtension(filename),
          ...(parsedNotes.get(path)?.aliases ?? []),
        ],
        target: { kind: 'page' as const, nodeKey },
      };
    });
    const folderEntries = folders.map((folder) => ({
      path: folder,
      names: [posix.basename(folder)],
      target: {
        kind: 'page' as const,
        nodeKey: ImportTreeBuilder.folderKey(folder),
      },
    }));
    const mediaEntries = mediaPaths.map((path) => ({
      path,
      names: [posix.basename(path)],
      target: { kind: 'media' as const, path },
    }));
    return [...noteEntries, ...folderEntries, ...mediaEntries];
  }

  private static orderParentsFirst(nodes: ImportNode[]): ImportNode[] {
    const childrenByParent = new Map<string | null, ImportNode[]>();
    for (const node of nodes) {
      const siblings = childrenByParent.get(node.parentKey) ?? [];
      siblings.push(node);
      childrenByParent.set(node.parentKey, siblings);
    }
    const ordered: ImportNode[] = [];
    const visit = (parentKey: string | null) => {
      const children = (childrenByParent.get(parentKey) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name, 'fr', { numeric: true }),
      );
      for (const child of children) {
        ordered.push(child);
        visit(child.key);
      }
    };
    visit(null);
    return ordered;
  }

  private static referencedMedia(
    nodes: ImportNode[],
    mediaFiles: Map<string, ImportSourceFile>,
    ignoredFiles: IgnoredImportFile[],
  ): ImportMediaFile[] {
    const ownerByPath = new Map<string, string>();
    for (const node of nodes) {
      for (const link of node.links) {
        if (link.kind === 'media' && !ownerByPath.has(link.path)) {
          ownerByPath.set(link.path, node.key);
        }
      }
    }

    const media: ImportMediaFile[] = [];
    for (const [path, file] of mediaFiles) {
      const ownerKey = ownerByPath.get(path);
      if (!ownerKey) {
        ignoredFiles.push({ path, reason: 'unreferenced' });
        continue;
      }
      const filename = posix.basename(path);
      media.push({
        path,
        filename,
        mimeType: attachmentMimeType(filename)!,
        size: file.data.length,
        data: file.data,
        ownerKey,
      });
    }
    return media;
  }

  private static detectFormat(
    archive: ImportArchiveContent,
    usesWikilinks: boolean,
    notes: ParsedNote[],
  ): ImportFormat {
    const hasObsidianConfig = archive.hiddenPaths.some((path) =>
      path.split('/').includes(OBSIDIAN_CONFIG_FOLDER),
    );
    if (hasObsidianConfig || usesWikilinks) {
      return 'obsidian';
    }
    return notes.every((note) => note.hasNestWikiSource)
      ? 'nestwiki'
      : 'markdown';
  }

  private static folderKey(folder: string): string {
    return `${folder}/`;
  }

  private static parentKeyOf(path: string): string | null {
    const parent = posix.dirname(path);
    return parent === '.' ? null : ImportTreeBuilder.folderKey(parent);
  }

  private static stripExtension(filename: string): string {
    const extension = posix.extname(filename);
    return MARKDOWN_EXTENSIONS.includes(extension.toLowerCase())
      ? filename.slice(0, -extension.length)
      : filename;
  }
}

class ImportArchiveIndex implements ImportLinkResolver {
  private readonly byLowerPath = new Map<string, ResolvableEntry>();

  constructor(private readonly entries: ResolvableEntry[]) {
    for (const entry of entries) {
      this.byLowerPath.set(entry.path.toLowerCase(), entry);
    }
  }

  resolvePath(fromFile: string, target: string): ImportResolvedTarget | null {
    const directory = posix.dirname(fromFile);
    const candidate = posix
      .normalize(posix.join(directory, target))
      .replace(/\/+$/, '');
    if (candidate === '.' || candidate.startsWith('..')) {
      return null;
    }
    const lowerCandidate = candidate.toLowerCase();
    const entry =
      this.byLowerPath.get(lowerCandidate) ??
      (posix.extname(candidate)
        ? undefined
        : MARKDOWN_EXTENSIONS.map((extension) =>
            this.byLowerPath.get(`${lowerCandidate}${extension}`),
          ).find(Boolean));
    return entry?.target ?? null;
  }

  resolveName(fromFile: string, name: string): ImportResolvedTarget | null {
    const wanted = name.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
    const candidates = wanted.includes('/')
      ? this.entries.filter((entry) =>
          ImportArchiveIndex.pathVariants(entry.path).some(
            (variant) => variant === wanted || variant.endsWith(`/${wanted}`),
          ),
        )
      : this.entries.filter((entry) =>
          entry.names.some((entryName) => entryName.toLowerCase() === wanted),
        );
    if (candidates.length === 0) {
      return null;
    }
    const fromSegments = posix.dirname(fromFile).split('/');
    const score = (entry: ResolvableEntry): number => {
      const segments = posix.dirname(entry.path).split('/');
      let shared = 0;
      while (
        shared < segments.length &&
        shared < fromSegments.length &&
        segments[shared] === fromSegments[shared]
      ) {
        shared += 1;
      }
      return shared;
    };
    const [closest] = candidates.sort(
      (a, b) =>
        score(b) - score(a) ||
        a.path.split('/').length - b.path.split('/').length ||
        a.path.localeCompare(b.path),
    );
    return closest.target;
  }

  private static pathVariants(path: string): string[] {
    const lower = path.toLowerCase();
    const extension = posix.extname(lower);
    return MARKDOWN_EXTENSIONS.includes(extension)
      ? [lower, lower.slice(0, -extension.length)]
      : [lower];
  }
}
