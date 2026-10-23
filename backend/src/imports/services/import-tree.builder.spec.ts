import { describe, expect, it } from 'vitest';
import { ImportTooLargeException } from '../../common/exceptions/imports/import-too-large.exception.js';
import { InvalidImportArchiveException } from '../../common/exceptions/imports/invalid-import-archive.exception.js';
import { MarkdownLinkRewriter } from '../../pages/services/markdown-link-rewriter.js';
import type { ImportArchiveContent } from './import-archive.reader.js';
import { ImportMarkdownConverter } from './import-markdown.converter.js';
import {
  ImportPlanner,
  type ExistingImportPage,
  type ImportConflictMode,
  type ImportDestination,
} from './import-planner.js';
import { ImportTreeBuilder, type ImportTree } from './import-tree.builder.js';

const ROOT: ImportDestination = { pageId: null, path: '', depth: 0 };

function archive(
  files: Record<string, string | Buffer>,
  hiddenPaths: string[] = [],
): ImportArchiveContent {
  return {
    files: Object.entries(files).map(([path, data]) => ({
      path,
      data: typeof data === 'string' ? Buffer.from(data) : data,
    })),
    ignored: [],
    hiddenPaths,
  };
}

function place(
  tree: ImportTree,
  options: {
    destination?: ImportDestination;
    existing?: Record<string, Record<string, ExistingImportPage>>;
    mode?: ImportConflictMode;
  } = {},
) {
  return ImportPlanner.place(
    tree,
    options.destination ?? ROOT,
    {
      childrenOf: (parentId) =>
        new Map(Object.entries(options.existing?.[parentId ?? 'root'] ?? {})),
    },
    options.mode ?? 'skip',
  );
}

function importFiles(
  files: Record<string, string | Buffer>,
  hiddenPaths: string[] = [],
) {
  const tree = ImportTreeBuilder.build(archive(files, hiddenPaths));
  const placement = place(tree);
  const pathByKey = new Map(
    placement.pages.map((page) => [page.node.key, page.path]),
  );
  const contentOf = (key: string): string => {
    const node = tree.nodes.find((candidate) => candidate.key === key)!;
    return ImportMarkdownConverter.render(node.body, node.links, {
      pagePath: (nodeKey) => pathByKey.get(nodeKey)!,
      mediaUrl: (path) => `/api/media/${path}/raw`,
    });
  };
  return { tree, placement, pathByKey, contentOf };
}

describe('ImportTreeBuilder', () => {
  describe('NestWiki export', () => {
    it('gives back the exported tree, titles, tags and links (round trip)', () => {
      const mediaId = '0b6f9f8e-7d1c-4b8e-9a51-2f6c5d0e1a23';
      const pages = [
        {
          path: '/guide',
          title: 'Guide de démarrage',
          tags: ['doc'],
          content:
            '# Guide de démarrage\n\nVoir [Installation](/pages/guide/installation#prerequis) et ![capture](/api/media/' +
            mediaId +
            '/raw).',
        },
        {
          path: '/guide/installation',
          title: 'Installation',
          tags: [],
          content:
            '# Installation\n\n## Prérequis\n\nRetour au [guide](/pages/guide) ou [Linux](/pages/guide/installation/linux).',
        },
        {
          path: '/guide/installation/linux',
          title: 'Linux',
          tags: ['os', 'linux'],
          content: '# Linux\n\n```bash\n[pas un lien](/pages/guide)\n```',
        },
      ];
      const exportedPages = new Map(
        pages.map((page) => [page.path, `${page.path.slice(1)}.md`]),
      );
      const mediaFiles = new Map([[mediaId, `_media/${mediaId}-capture.png`]]);
      const files: Record<string, string | Buffer> = {
        [`_media/${mediaId}-capture.png`]: Buffer.from([137, 80, 78, 71]),
      };
      for (const page of pages) {
        const currentFile = exportedPages.get(page.path)!;
        files[currentFile] = [
          '---',
          `title: ${JSON.stringify(page.title)}`,
          `tags: ${JSON.stringify(page.tags)}`,
          'updatedAt: 2026-10-01T10:00:00.000Z',
          `source: "https://wiki.example.com/pages${page.path}"`,
          '---',
          '',
          MarkdownLinkRewriter.rewrite(page.content, {
            currentFile,
            exportedPages,
            mediaFiles,
            instanceUrl: 'https://wiki.example.com',
          }),
        ].join('\n');
      }

      const { tree, placement, contentOf } = importFiles(files);

      expect(tree.format).toBe('nestwiki');
      expect(
        placement.pages.map((page) => [
          page.path,
          page.node.title,
          page.node.tags,
        ]),
      ).toEqual(pages.map((page) => [page.path, page.title, page.tags]));
      expect(contentOf('guide/')).toBe(
        pages[0].content.replace(
          `/api/media/${mediaId}/raw`,
          `/api/media/_media/${mediaId}-capture.png/raw`,
        ),
      );
      expect(contentOf('guide/installation/')).toBe(pages[1].content);
      expect(contentOf('guide/installation/linux.md')).toBe(pages[2].content);
      expect(tree.media).toEqual([
        expect.objectContaining({
          filename: `${mediaId}-capture.png`,
          mimeType: 'image/png',
          ownerKey: 'guide/',
        }),
      ]);
      expect(tree.unresolvedLinks).toEqual([]);
    });
  });

  describe('Obsidian vault', () => {
    it('converts every wikilink form', () => {
      const { tree, contentOf } = importFiles(
        {
          'Notes/Source.md': [
            '# Source',
            '',
            '[[Cible]] · [[Cible|texte]] · [[Cible#Mon Titre]] · [[Cible#Mon Titre|ici]] · [[#Plus bas]] · [[Cible#^bloc]]',
          ].join('\n'),
          'Archives/Cible.md': '# Cible\n\n## Mon Titre',
        },
        ['.obsidian/app.json'],
      );

      expect(tree.format).toBe('obsidian');
      expect(contentOf('Notes/Source.md')).toBe(
        [
          '# Source',
          '',
          '[Cible](/pages/archives/cible) · [texte](/pages/archives/cible) · [Cible > Mon Titre](/pages/archives/cible#mon-titre) · [ici](/pages/archives/cible#mon-titre) · [Plus bas](#plus-bas) · [Cible](/pages/archives/cible)',
        ].join('\n'),
      );
    });

    it('converts embeds: images with or without width, notes and other files', () => {
      const { tree, contentOf } = importFiles({
        'Note.md':
          '# Note\n\n![[photo.png]]\n![[photo.png|300]]\n![[photo.png|300x200]]\n![[Autre]]\n![[doc.pdf]]',
        'Autre.md': '# Autre',
        'assets/photo.png': Buffer.from([1]),
        'assets/doc.pdf': Buffer.from([2]),
      });

      expect(contentOf('Note.md')).toBe(
        [
          '# Note',
          '',
          '![photo.png](/api/media/assets/photo.png/raw)',
          '<img src="/api/media/assets/photo.png/raw" alt="photo.png" width="300">',
          '<img src="/api/media/assets/photo.png/raw" alt="photo.png" width="300" height="200">',
          '[Autre](/pages/autre)',
          '[doc.pdf](/api/media/assets/doc.pdf/raw)',
        ].join('\n'),
      );
      expect(tree.media.map((media) => media.path)).toEqual([
        'assets/photo.png',
        'assets/doc.pdf',
      ]);
    });

    it('turns folders into parent pages, using their folder note when there is one', () => {
      const { placement, contentOf } = importFiles({
        'Projet/Projet.md': '# Le projet',
        'Projet/Tâche.md': '# Tâche',
        'Voisin.md': '# Voisin (note de dossier)',
        'Voisin/Enfant.md': '# Enfant',
        'Docs/index.md': '# Documentation',
        'Docs/Page.md': '# Page',
        'Wiki/README.md': '# Lisez-moi',
        'Wiki/Page.md': '# Page wiki',
        'Vide/Sous/Note.md': '# Note',
      });

      expect(
        placement.pages.map((page) => [page.path, page.node.title]),
      ).toEqual([
        ['/docs', 'Documentation'],
        ['/docs/page', 'Page'],
        ['/projet', 'Le projet'],
        ['/projet/tache', 'Tâche'],
        ['/vide', 'Vide'],
        ['/vide/sous', 'Sous'],
        ['/vide/sous/note', 'Note'],
        ['/voisin', 'Voisin (note de dossier)'],
        ['/voisin/enfant', 'Enfant'],
        ['/wiki', 'Lisez-moi'],
        ['/wiki/page', 'Page wiki'],
      ]);
      expect(contentOf('Vide/')).toBe('# Vide');
    });

    it('resolves names like Obsidian: unique name, then the closest path, then aliases', () => {
      const { contentOf } = importFiles({
        'A/Note.md': '# A\n\n[[Note]] [[B/Note]] [[Surnom]] [[Projet]]',
        'B/Note.md': '# B',
        'Projet/index.md': '# Projet',
        'Projet/Autre.md': '---\naliases: [Surnom]\n---\n# Autre',
      });

      expect(contentOf('A/Note.md')).toBe(
        '# A\n\n[Note](/pages/a/note) [B/Note](/pages/b/note) [Surnom](/pages/projet/autre) [Projet](/pages/projet)',
      );
    });

    it('reads frontmatter and inline tags, but not in code or headings', () => {
      const { tree } = importFiles({
        'Note.md': [
          '---',
          'tags: [projet, "#urgent"]',
          '---',
          '# Note #titre',
          '',
          'Texte #inline et #nested/tag, pas#collé, pas #123.',
          '`#code` et',
          '```',
          '#bloc',
          '```',
          '## Section #section',
        ].join('\n'),
        'Autre.md': '---\ntags: projet, Inline\n---\n# Autre',
      });

      expect(tree.nodes.map((node) => node.tags)).toEqual([
        ['projet', 'Inline'],
        ['projet', 'urgent', 'inline', 'nested/tag'],
      ]);
    });

    it('removes %%comments%% and converts ==highlights== outside code', () => {
      const { contentOf } = importFiles({
        'Note.md':
          '# Note\n\nVisible %%caché%% texte.\n%%\nbloc caché\n%%\nUn ==passage== surligné, `==code==`.',
      });

      expect(contentOf('Note.md')).toBe(
        '# Note\n\nVisible  texte.\n\nUn <mark>passage</mark> surligné, `==code==`.',
      );
    });

    it('keeps unresolved links as they are and lists them', () => {
      const { tree, contentOf } = importFiles({
        'Note.md': '# Note\n\n[[Absente]] ![[absente.png]] [lien](manquant.md)',
      });

      expect(contentOf('Note.md')).toBe(
        '# Note\n\n[[Absente]] ![[absente.png]] [lien](manquant.md)',
      );
      expect(tree.unresolvedLinks).toEqual([
        { nodeKey: 'Note.md', target: 'manquant.md' },
        { nodeKey: 'Note.md', target: 'absente.png' },
        { nodeKey: 'Note.md', target: 'Absente' },
      ]);
    });
  });

  describe('plain Markdown', () => {
    it('resolves relative links with or without extension, encoded or between angle brackets', () => {
      const { tree, contentOf } = importFiles({
        'docs/a.md':
          '# A\n\n[b](./b.md) [b sans ext](b) [c](../c.md#Une%20Section) [espace](<mon fichier.md>) [encodé](mon%20fichier.md) ![img](./img/x.png) [ext](https://example.com/b.md) [ancre](#local)\n\n[ref]: ../c.md',
        'docs/b.md': '# B',
        'docs/mon fichier.md': '# Mon fichier',
        'docs/img/x.png': Buffer.from([1]),
        'c.md': '# C',
      });

      expect(tree.format).toBe('markdown');
      expect(contentOf('docs/a.md')).toBe(
        '# A\n\n[b](/pages/docs/b) [b sans ext](/pages/docs/b) [c](/pages/c#une-section) [espace](/pages/docs/mon-fichier) [encodé](/pages/docs/mon-fichier) ![img](/api/media/docs/img/x.png/raw) [ext](https://example.com/b.md) [ancre](#local)\n\n[ref]: /pages/c',
      );
    });

    it('ignores unsupported and unreferenced files', () => {
      const { tree } = importFiles({
        'note.md': '# Note',
        'dessin.svg': '<svg/>',
        'seul.png': Buffer.from([1]),
      });

      expect(tree.ignoredFiles).toEqual([
        { path: 'dessin.svg', reason: 'unsupported_type' },
        { path: 'seul.png', reason: 'unreferenced' },
      ]);
      expect(tree.media).toEqual([]);
    });
  });

  describe('titles', () => {
    it('takes the frontmatter title, then the first heading, then the file name', () => {
      const { tree, contentOf } = importFiles({
        'a.md': '---\ntitle: Titre YAML\n---\nTexte',
        'b.md': 'Intro\n\n# Titre du texte\n\nSuite',
        'c-fichier.md': 'Pas de titre',
      });

      expect(tree.nodes.map((node) => node.title)).toEqual([
        'Titre YAML',
        'Titre du texte',
        'c-fichier',
      ]);
      expect(contentOf('a.md')).toBe('# Titre YAML\n\nTexte');
      expect(contentOf('b.md')).toBe(
        '# Titre du texte\n\nIntro\n\n# Titre du texte\n\nSuite',
      );
      expect(contentOf('c-fichier.md')).toBe('# c-fichier\n\nPas de titre');
    });
  });

  describe('limits', () => {
    it('rejects an archive without any Markdown file', () => {
      expect(() =>
        ImportTreeBuilder.build(archive({ 'image.png': Buffer.from([1]) })),
      ).toThrow(InvalidImportArchiveException);
    });

    it('rejects more than 1000 pages', () => {
      const files = Object.fromEntries(
        Array.from({ length: 1001 }, (_, index) => [
          `note-${index}.md`,
          '# Note',
        ]),
      );

      expect(() => ImportTreeBuilder.build(archive(files))).toThrow(
        ImportTooLargeException,
      );
    });
  });
});

describe('ImportPlanner', () => {
  it('derives slugs from names with accents removed', () => {
    const { placement } = importFiles({ 'Été à Paris !.md': '# Été' });

    expect(placement.pages[0].slug).toBe('ete-a-paris');
  });

  it('suffixes reserved slugs at the root and under a root page', () => {
    const { placement } = importFiles({
      'trash.md': '# Corbeille',
      'Projet/tags.md': '# Tags',
      'Projet/Sous/tags.md': '# Tags profonds',
    });

    expect(placement.pages.map((page) => page.path)).toEqual([
      '/projet',
      '/projet/sous',
      '/projet/sous/tags',
      '/projet/tags-2',
      '/trash-2',
    ]);
    expect(placement.renamedSlugs).toEqual([
      {
        nodeKey: 'Projet/tags.md',
        from: 'tags',
        to: 'tags-2',
        reason: 'reserved',
      },
      { nodeKey: 'trash.md', from: 'trash', to: 'trash-2', reason: 'reserved' },
    ]);
  });

  it('suffixes duplicate slugs at the same level', () => {
    const { placement } = importFiles({
      'Note.md': '# Note',
      'note!.md': '# Note bis',
      'NOTE.markdown': '# Note ter',
    });

    expect(placement.pages.map((page) => page.slug).sort()).toEqual([
      'note',
      'note-2',
      'note-3',
    ]);
  });

  it('places pages under the destination and reports conflicts with existing pages', () => {
    const tree = ImportTreeBuilder.build(
      archive({ 'Guide.md': '# Guide', 'Guide/Install.md': '# Install' }),
    );
    const destination = { pageId: 'docs-id', path: '/docs', depth: 1 };
    const existing = {
      'docs-id': { guide: { id: 'guide-id', path: '/docs/guide' } },
      'guide-id': {
        install: { id: 'install-id', path: '/docs/guide/install' },
      },
    };

    const skipped = place(tree, { destination, existing, mode: 'skip' });
    const updated = place(tree, { destination, existing, mode: 'update' });
    const renamed = place(tree, { destination, existing, mode: 'rename' });

    expect(
      skipped.pages.map((page) => [page.path, page.action, page.conflict?.id]),
    ).toEqual([
      ['/docs/guide', 'skip', 'guide-id'],
      ['/docs/guide/install', 'skip', 'install-id'],
    ]);
    expect(updated.pages.map((page) => page.action)).toEqual([
      'update',
      'update',
    ]);
    expect(
      renamed.pages.map((page) => [page.path, page.action, page.conflict]),
    ).toEqual([
      ['/docs/guide-2', 'create', null],
      ['/docs/guide-2/install', 'create', null],
    ]);
  });
});
