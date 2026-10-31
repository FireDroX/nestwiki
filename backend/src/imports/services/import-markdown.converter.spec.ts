import { describe, expect, it } from 'vitest';
import {
  ImportMarkdownConverter,
  type ImportLinkResolver,
} from './import-markdown.converter.js';

const resolver: ImportLinkResolver = {
  resolvePath: () => null,
  resolveName: (_fromFile, name) =>
    name === 'Cible' ? { kind: 'page', nodeKey: 'cible.md' } : null,
};

function elapsedMs(run: () => unknown): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

describe('ImportMarkdownConverter', () => {
  it('still converts wikilinks, embeds and angle-bracket links', () => {
    const converted = ImportMarkdownConverter.convert(
      'Voir [[Cible]], ![[Absente]] et [lien](<Cible.md>)',
      'note.md',
      resolver,
    );

    expect(converted.links).toEqual([
      { kind: 'page', nodeKey: 'cible.md', anchor: null },
    ]);
    expect(converted.unresolved).toEqual(['Cible.md', 'Absente']);
  });

  it('ignores the colors of style blocks and attributes when collecting tags', () => {
    const converted = ImportMarkdownConverter.convert(
      '<style>p { color: #abc }</style>\n<span style="color: #def"> #tag</span>\n<style> #open',
      'note.md',
      resolver,
    );

    expect(converted.inlineTags).toEqual(['tag', 'open']);
  });

  it.each([
    ['opening brackets', '['.repeat(50_000)],
    ['embeds', '![['.repeat(20_000)],
    ['angle-bracket links', '](<'.repeat(20_000)],
    ['reference definitions', `[a]: <${'<'.repeat(50_000)}`],
    ['unclosed style blocks', '<style '.repeat(20_000)],
  ])('converts a line of %s in linear time', (_label, markdown) => {
    expect(
      elapsedMs(() =>
        ImportMarkdownConverter.convert(markdown, 'note.md', resolver),
      ),
    ).toBeLessThan(200);
  });
});
