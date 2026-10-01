import type { PageAction } from '../../common/permissions.js';
import { PageTreeNodeDto } from '../dto/out/page-tree-node.dto.js';
import { Page } from '../entities/page.entity.js';

export class PageTreeMapper {
  static buildTree(
    pages: Page[],
    actionsByPageId: Map<string, PageAction[]>,
  ): PageTreeNodeDto[] {
    const nodesById = new Map<string, PageTreeNodeDto>();
    for (const page of pages) {
      nodesById.set(page.id, {
        id: page.id,
        slug: page.slug,
        title: page.title,
        canCreateChild: (actionsByPageId.get(page.id) ?? []).includes(
          'page.create_child',
        ),
        children: [],
      });
    }

    const roots: PageTreeNodeDto[] = [];
    for (const page of pages) {
      const node = nodesById.get(page.id)!;
      const parent = page.parentId ? nodesById.get(page.parentId) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}
