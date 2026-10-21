import { describe, expect, it } from 'vitest';
import { Page } from '../entities/page.entity.js';
import { PagePathIndex } from './page-path-index.js';

function page(id: string, slug: string, parentId: string | null): Page {
  return { id, slug, parentId } as Page;
}

describe('PagePathIndex', () => {
  const index = new PagePathIndex([
    page('install', 'install', 'guide'),
    page('docs', 'docs', null),
    page('guide', 'guide', 'docs'),
    page('orphan', 'orphan', 'trashed-parent'),
  ]);

  it('builds the full slug path of every page, whatever the loading order', () => {
    expect(index.pathOf('docs')).toBe('/docs');
    expect(index.pathOf('install')).toBe('/docs/guide/install');
  });

  it('resolves a path back to its page', () => {
    expect(index.resolve('/docs/guide')).toBe('guide');
    expect(index.resolve('/docs/nope')).toBeUndefined();
  });

  it('leaves out pages whose ancestors are not in the list', () => {
    expect(index.pathOf('orphan')).toBeUndefined();
    expect(index.resolve('/orphan')).toBeUndefined();
  });
});
