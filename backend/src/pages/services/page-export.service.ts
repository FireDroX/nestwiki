import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { posix } from 'node:path';
import { ExportTooLargeException } from '../../common/exceptions/pages/export-too-large.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import {
  EXPORT_MAX_MEDIA,
  EXPORT_MAX_PAGES,
} from '../../common/variables.global.js';
import type { AuthenticatedUser } from '../../common/strategies/jwt.strategy.js';
import { MediaService } from '../../media/services/media.service.js';
import { TagsService } from '../../tags/services/tags.service.js';
import type { PageTreeNodeDto } from '../dto/out/page-tree-node.dto.js';
import type { SubtreePageResponseDto } from '../dto/out/subtree-page-response.dto.js';
import type { PageTrashRepository } from '../persistence/page-trash.repository.js';
import type { PagesRepository } from '../persistence/page.repository.js';
import { MarkdownLinkRewriter } from './markdown-link-rewriter.js';
import { PagesService } from './pages.service.js';

export interface ExportedFile {
  filename: string;
  content: string;
}

export interface ExportArchiveEntry {
  name: string;
  data: string | Buffer | (() => Promise<Buffer | null>);
}

export interface ExportArchive {
  filename: string;
  entries: ExportArchiveEntry[];
}

interface OrderedNode {
  node: PageTreeNodeDto;
  depth: number;
}

const MEDIA_FOLDER = '_media';
const EXPORT_SCOPES = ['page', 'subtree'] as const;

export type ExportScope = (typeof EXPORT_SCOPES)[number];

@Injectable()
export class PageExportService {
  private readonly instanceUrl: string;

  constructor(
    private readonly pagesService: PagesService,
    @Inject('PagesRepository')
    private readonly pagesRepository: PagesRepository,
    @Inject('PageTrashRepository')
    private readonly pageTrashRepository: PageTrashRepository,
    @Inject(forwardRef(() => TagsService))
    private readonly tagsService: TagsService,
    @Inject(forwardRef(() => MediaService))
    private readonly mediaService: MediaService,
    configService: ConfigService,
  ) {
    this.instanceUrl = (
      configService.get<string>('FRONTEND_URL') ?? ''
    ).replace(/\/+$/, '');
  }

  static parseScope(raw: string | undefined): ExportScope {
    const scope = raw ?? 'page';
    if (!(EXPORT_SCOPES as readonly string[]).includes(scope)) {
      throw new ValidationException('scope must be page or subtree');
    }
    return scope as ExportScope;
  }

  collectSubtree(
    id: string,
    currentUser?: AuthenticatedUser,
  ): Promise<SubtreePageResponseDto[]> {
    return this.collect(id, currentUser, true);
  }

  async exportPage(
    id: string,
    currentUser?: AuthenticatedUser,
  ): Promise<ExportedFile> {
    const [page] = await this.collect(id, currentUser, false);
    const filename = `${page.slug}.md`;
    return {
      filename,
      content: this.toMarkdownFile(page, {
        currentFile: filename,
        exportedPages: new Map(),
        mediaFiles: new Map(),
      }),
    };
  }

  async exportSubtree(
    id: string,
    currentUser?: AuthenticatedUser,
  ): Promise<ExportArchive> {
    const pages = await this.collect(id, currentUser, true);
    const rootFolder = posix.dirname(pages[0].path);
    const exportedPages = new Map(
      pages.map((page) => [
        page.path,
        `${posix.relative(rootFolder, page.path)}.md`,
      ]),
    );
    const media = await this.findExportableMedia(pages, currentUser);
    const mediaFiles = new Map(media.map(({ id, name }) => [id, name]));

    const pageEntries = pages.map((page) => {
      const currentFile = exportedPages.get(page.path)!;
      return {
        name: currentFile,
        data: this.toMarkdownFile(page, {
          currentFile,
          exportedPages,
          mediaFiles,
        }),
      };
    });

    return {
      filename: `${pages[0].slug}.zip`,
      entries: [
        ...pageEntries,
        ...media.map(({ name, read }) => ({ name, data: read })),
      ],
    };
  }

  private async collect(
    id: string,
    currentUser: AuthenticatedUser | undefined,
    withDescendants: boolean,
  ): Promise<SubtreePageResponseDto[]> {
    const root = await this.pagesService.getByIdOrFail(id, currentUser);
    const rootLeaf: PageTreeNodeDto = {
      id: root.id,
      slug: root.slug,
      title: root.title,
      visibility: root.visibility,
      canCreateChild: false,
      children: [],
    };
    const ordered = withDescendants
      ? PageExportService.flatten(
          PageExportService.findNode(
            await this.pagesService.getTree(currentUser),
            root.id,
          ) ?? rootLeaf,
          0,
        )
      : [{ node: rootLeaf, depth: 0 }];
    if (ordered.length > EXPORT_MAX_PAGES) {
      throw new ExportTooLargeException();
    }

    const ids = ordered.map(({ node }) => node.id);
    const [paths, versions, tagNames] = await Promise.all([
      this.pageTrashRepository.findPaths(ids),
      this.pagesRepository.findCurrentVersions(ids),
      this.tagsService.listTagNamesOfAlreadyAuthorizedPages(ids),
    ]);
    const versionsByPageId = new Map(
      versions.map((version) => [version.pageId, version]),
    );

    return ordered.map(({ node, depth }) => {
      const version = versionsByPageId.get(node.id);
      return {
        id: node.id,
        title: node.title,
        slug: node.slug,
        path: paths.get(node.id) ?? `/${node.slug}`,
        depth,
        content: version?.content ?? '',
        tags: tagNames.get(node.id) ?? [],
        updatedAt: version?.createdAt ?? root.updatedAt,
      };
    });
  }

  private async findExportableMedia(
    pages: SubtreePageResponseDto[],
    currentUser?: AuthenticatedUser,
  ): Promise<
    { id: string; name: string; read: () => Promise<Buffer | null> }[]
  > {
    const ids = [
      ...new Set(
        pages.flatMap((page) =>
          MarkdownLinkRewriter.findMediaIds(page.content, this.instanceUrl),
        ),
      ),
    ];
    if (ids.length > EXPORT_MAX_MEDIA) {
      throw new ExportTooLargeException();
    }

    const media: {
      id: string;
      name: string;
      read: () => Promise<Buffer | null>;
    }[] = [];
    for (const id of ids) {
      const exportable = await this.mediaService.findExportable(
        id,
        currentUser,
      );
      if (exportable) {
        media.push({
          id,
          name: `${MEDIA_FOLDER}/${id}-${PageExportService.safeFilename(exportable.filename)}`,
          read: exportable.read,
        });
      }
    }
    return media;
  }

  private toMarkdownFile(
    page: SubtreePageResponseDto,
    links: {
      currentFile: string;
      exportedPages: Map<string, string>;
      mediaFiles: Map<string, string>;
    },
  ): string {
    const header = [
      '---',
      `title: ${JSON.stringify(page.title)}`,
      `tags: ${JSON.stringify(page.tags)}`,
      `updatedAt: ${page.updatedAt.toISOString()}`,
      `source: ${JSON.stringify(`${this.instanceUrl}/pages${page.path}`)}`,
      '---',
      '',
    ].join('\n');
    const body = MarkdownLinkRewriter.rewrite(page.content, {
      ...links,
      instanceUrl: this.instanceUrl,
    });
    return `${header}\n${body}`;
  }

  private static findNode(
    nodes: PageTreeNodeDto[],
    id: string,
  ): PageTreeNodeDto | undefined {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }
      const found = PageExportService.findNode(node.children, id);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  private static flatten(node: PageTreeNodeDto, depth: number): OrderedNode[] {
    return [
      { node, depth },
      ...node.children.flatMap((child) =>
        PageExportService.flatten(child, depth + 1),
      ),
    ];
  }

  private static safeFilename(filename: string): string {
    return filename.replace(/[^\w.-]+/g, '-');
  }
}
