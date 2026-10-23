import { slugify } from '../../common/slug.js';
import {
  RESERVED_CHILD_OF_ROOT_PAGE_SLUGS,
  RESERVED_ROOT_PAGE_SLUGS,
  SLUG_MAX_LENGTH,
} from '../../common/variables.global.js';
import type { ImportNode, ImportTree } from './import-tree.builder.js';

export const IMPORT_CONFLICT_MODES = ['skip', 'rename', 'update'] as const;
export type ImportConflictMode = (typeof IMPORT_CONFLICT_MODES)[number];

export type ImportPageAction = 'create' | 'update' | 'skip';
export type ImportRenameReason = 'reserved' | 'duplicate' | 'conflict';

export interface ExistingImportPage {
  id: string;
  path: string;
}

export interface ImportDestination {
  pageId: string | null;
  path: string;
  depth: number;
}

export interface ExistingPagesIndex {
  childrenOf(parentId: string | null): Map<string, ExistingImportPage>;
}

export interface PlannedImportPage {
  node: ImportNode;
  slug: string;
  path: string;
  depth: number;
  action: ImportPageAction;
  conflict: ExistingImportPage | null;
}

export interface RenamedImportSlug {
  nodeKey: string;
  from: string;
  to: string;
  reason: ImportRenameReason;
}

export interface ImportPlacement {
  pages: PlannedImportPage[];
  renamedSlugs: RenamedImportSlug[];
}

const FALLBACK_SLUG = 'page';
const NO_EXISTING_CHILDREN = new Map<string, ExistingImportPage>();

export class ImportPlanner {
  static place(
    tree: ImportTree,
    destination: ImportDestination,
    existingPages: ExistingPagesIndex,
    conflictMode: ImportConflictMode,
  ): ImportPlacement {
    const placed = new Map<string, PlannedImportPage>();
    const claimedByParent = new Map<string, Set<string>>();
    const renamedSlugs: RenamedImportSlug[] = [];

    for (const node of tree.nodes) {
      const parent = node.parentKey ? placed.get(node.parentKey)! : null;
      const depth = (parent?.depth ?? destination.depth) + 1;
      const existingSiblings =
        parent?.action === 'create'
          ? NO_EXISTING_CHILDREN
          : existingPages.childrenOf(
              parent ? parent.conflict!.id : destination.pageId,
            );
      const claimKey = parent?.node.key ?? '';
      const claimed = claimedByParent.get(claimKey) ?? new Set<string>();
      claimedByParent.set(claimKey, claimed);

      const base = ImportPlanner.baseSlug(node.name);
      const isTaken = (slug: string) =>
        claimed.has(slug) ||
        existingSiblings.has(slug) ||
        ImportPlanner.isReserved(slug, depth);
      let slug = base;
      let reason: ImportRenameReason | null = null;
      if (ImportPlanner.isReserved(base, depth)) {
        reason = 'reserved';
      } else if (claimed.has(base)) {
        reason = 'duplicate';
      } else if (existingSiblings.has(base) && conflictMode === 'rename') {
        reason = 'conflict';
      }
      if (reason) {
        slug = ImportPlanner.nextFreeSlug(base, isTaken);
        renamedSlugs.push({ nodeKey: node.key, from: base, to: slug, reason });
      }
      claimed.add(slug);

      const conflict = existingSiblings.get(slug) ?? null;
      const planned: PlannedImportPage = {
        node,
        slug,
        path: `${parent?.path ?? destination.path}/${slug}`,
        depth,
        action: conflict
          ? conflictMode === 'update'
            ? 'update'
            : 'skip'
          : 'create',
        conflict,
      };
      placed.set(node.key, planned);
    }

    return { pages: [...placed.values()], renamedSlugs };
  }

  private static baseSlug(name: string): string {
    return (
      slugify(name).slice(0, SLUG_MAX_LENGTH).replace(/-+$/, '') ||
      FALLBACK_SLUG
    );
  }

  private static nextFreeSlug(
    base: string,
    isTaken: (slug: string) => boolean,
  ): string {
    for (let suffix = 2; ; suffix += 1) {
      const ending = `-${suffix}`;
      const candidate = `${base.slice(0, SLUG_MAX_LENGTH - ending.length)}${ending}`;
      if (!isTaken(candidate)) {
        return candidate;
      }
    }
  }

  private static isReserved(slug: string, depth: number): boolean {
    if (depth === 1) {
      return RESERVED_ROOT_PAGE_SLUGS.includes(slug);
    }
    return depth === 2 && RESERVED_CHILD_OF_ROOT_PAGE_SLUGS.includes(slug);
  }
}
