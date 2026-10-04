import { describe, expect, it } from 'vitest';
import { PageCardDto } from '../dto/out/page-card.dto.js';
import { PageCardMapper } from './page-card.mapper.js';

function buildCard(overrides: Partial<PageCardDto> = {}): PageCardDto {
  return {
    title: 'Installation',
    ancestorTitles: ['Documentation', 'Guides'],
    tagNames: ['guide', 'installation'],
    stats: {
      viewCount: 1240,
      lastModifiedAt: new Date('2026-10-01T10:00:00Z'),
      lastModifiedBy: { id: 'author-1', displayName: 'Alice' },
      versionsCount: 12,
      commentsCount: 5,
      contributorsCount: 3,
    },
    pageUrl: 'https://wiki.example.com/pages/docs/guides/installation',
    editUrl: 'https://wiki.example.com/edit/docs/guides/installation',
    ...overrides,
  };
}

function textContents(card: PageCardDto): string[] {
  return PageCardMapper.toDiscordEmbed(card)
    .component.components.filter((child) => child.type === 10)
    .map((child) => (child.type === 10 ? child.content : ''));
}

describe('PageCardMapper', () => {
  it('renders title, breadcrumb, tags, separator, stats, last modification and buttons', () => {
    const embed = PageCardMapper.toDiscordEmbed(buildCard());

    expect(embed.component.type).toBe(17);
    expect(embed.component.accent_color).toBe(0xec3013);
    expect(embed.component.components.map((child) => child.type)).toEqual([
      10, 10, 10, 14, 10, 10, 1,
    ]);
    expect(textContents(buildCard())).toEqual([
      '# Installation',
      'Documentation › Guides › Installation',
      '🏷 guide · installation',
      '👁 1 240 vues · ✏️ 12 versions · 💬 5 commentaires · 👥 3 contributeurs',
      '🕒 Modifiée le 1 octobre 2026 par Alice',
    ]);
  });

  it('omits the breadcrumb line for a root page and the tags line without tags', () => {
    const contents = textContents(
      buildCard({ ancestorTitles: [], tagNames: [] }),
    );

    expect(contents).toEqual([
      '# Installation',
      '👁 1 240 vues · ✏️ 12 versions · 💬 5 commentaires · 👥 3 contributeurs',
      '🕒 Modifiée le 1 octobre 2026 par Alice',
    ]);
  });

  it('caps the tag list and shows how many are hidden', () => {
    const tagNames = Array.from({ length: 11 }, (_, i) => `t${i + 1}`);

    const [, , tagsLine] = textContents(buildCard({ tagNames }));

    expect(tagsLine).toBe('🏷 t1 · t2 · t3 · t4 · t5 · t6 · t7 · t8 +3');
  });

  it('uses singular forms and drops the author when unknown', () => {
    const contents = textContents(
      buildCard({
        stats: {
          viewCount: 1,
          lastModifiedAt: new Date('2026-10-01T10:00:00Z'),
          lastModifiedBy: null,
          versionsCount: 1,
          commentsCount: 0,
          contributorsCount: 1,
        },
      }),
    );

    expect(contents.slice(-2)).toEqual([
      '👁 1 vue · ✏️ 1 version · 💬 0 commentaire · 👥 1 contributeur',
      '🕒 Modifiée le 1 octobre 2026',
    ]);
  });

  it('escapes discord markdown from page titles, tags and author names', () => {
    const contents = textContents(
      buildCard({
        title: '**Bold**',
        tagNames: ['[x](https://evil.example)'],
        stats: {
          ...buildCard().stats,
          lastModifiedBy: { id: 'a', displayName: '_alice_' },
        },
      }),
    );

    expect(contents[0]).toBe('# \\*\\*Bold\\*\\*');
    expect(contents[2]).toBe('🏷 \\[x\\]\\(https\\://evil.example\\)');
    expect(contents.at(-1)).toBe(
      '🕒 Modifiée le 1 octobre 2026 par \\_alice\\_',
    );
  });

  it('builds a structured og description', () => {
    expect(PageCardMapper.toDescription(buildCard())).toBe(
      'Documentation › Guides › Installation · 2 tags · 1 240 vues',
    );
    expect(
      PageCardMapper.toDescription(
        buildCard({ ancestorTitles: [], tagNames: [] }),
      ),
    ).toBe('Installation · 1 240 vues');
  });
});
