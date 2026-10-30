import { describe, expect, it } from 'vitest';
import { MarkdownLinkRewriter } from './markdown-link-rewriter.js';

const INSTANCE_URL = 'https://wiki.example.com';
const MEDIA_ID = '11111111-2222-4333-8444-555555555555';
const OTHER_MEDIA_ID = '99999999-2222-4333-8444-555555555555';

function rewrite(content: string, currentFile = 'guide.md'): string {
  return MarkdownLinkRewriter.rewrite(content, {
    currentFile,
    exportedPages: new Map([
      ['/docs/guide', 'guide.md'],
      ['/docs/guide/install', 'guide/install.md'],
      ['/docs/guide/install/linux', 'guide/install/linux.md'],
    ]),
    mediaFiles: new Map([[MEDIA_ID, `_media/${MEDIA_ID}-shot.png`]]),
    instanceUrl: INSTANCE_URL,
  });
}

describe('MarkdownLinkRewriter', () => {
  it('points a link to an exported page at its relative .md file and keeps the anchor', () => {
    expect(rewrite('[Install](/pages/docs/guide/install#linux)')).toBe(
      '[Install](guide/install.md#linux)',
    );
  });

  it('resolves relative paths from a page nested more than one level deep', () => {
    expect(rewrite('[Back](/pages/docs/guide)', 'guide/install/linux.md')).toBe(
      '[Back](../../guide.md)',
    );
    expect(
      rewrite('[Sibling](/pages/docs/guide/install)', 'guide/install/linux.md'),
    ).toBe('[Sibling](../install.md)');
  });

  it('turns a link to a page outside the export into an absolute instance URL', () => {
    expect(rewrite('[FAQ](/pages/faq#top)')).toBe(
      `[FAQ](${INSTANCE_URL}/pages/faq#top)`,
    );
  });

  it('treats absolute links to the instance like relative ones', () => {
    expect(rewrite(`[Install](${INSTANCE_URL}/pages/docs/guide/install)`)).toBe(
      '[Install](guide/install.md)',
    );
  });

  it('points an exported media at its file in _media, and other media at the instance', () => {
    expect(
      rewrite(
        `![shot](${INSTANCE_URL}/api/media/${MEDIA_ID}/raw) ![other](/api/media/${OTHER_MEDIA_ID}/raw)`,
        'guide/install.md',
      ),
    ).toBe(
      `![shot](../_media/${MEDIA_ID}-shot.png) ![other](${INSTANCE_URL}/api/media/${OTHER_MEDIA_ID}/raw)`,
    );
  });

  it('rewrites src and href attributes of raw HTML', () => {
    expect(
      rewrite(
        `<img src="/api/media/${MEDIA_ID}/raw"> <a href="/pages/docs/guide/install">x</a>`,
      ),
    ).toBe(
      `<img src="_media/${MEDIA_ID}-shot.png"> <a href="guide/install.md">x</a>`,
    );
  });

  it('leaves external links and in-page anchors untouched', () => {
    const content =
      '[ext](https://example.org/pages/docs/guide) [anchor](#section)';
    expect(rewrite(content)).toBe(content);
  });

  it('makes every wiki link absolute when nothing else is exported', () => {
    expect(
      MarkdownLinkRewriter.rewrite(
        `[Install](/pages/docs/guide/install) ![shot](/api/media/${MEDIA_ID}/raw)`,
        {
          currentFile: 'guide.md',
          exportedPages: new Map(),
          mediaFiles: new Map(),
          instanceUrl: INSTANCE_URL,
        },
      ),
    ).toBe(
      `[Install](${INSTANCE_URL}/pages/docs/guide/install) ![shot](${INSTANCE_URL}/api/media/${MEDIA_ID}/raw)`,
    );
  });

  it('lists the media referenced by a content, once each', () => {
    expect(
      MarkdownLinkRewriter.findMediaIds(
        `![a](/api/media/${MEDIA_ID}/raw) ![b](${INSTANCE_URL}/api/media/${MEDIA_ID}/raw) <img src="/api/media/${OTHER_MEDIA_ID}/raw">`,
        INSTANCE_URL,
      ),
    ).toEqual([MEDIA_ID, OTHER_MEDIA_ID]);
  });

  it('leaves links inside code blocks and inline code untouched', () => {
    const content = [
      'See [Install](/pages/docs/guide/install).',
      '',
      '```md',
      '[Install](/pages/docs/guide/install)',
      '```',
      '',
      'Write `[x](/pages/docs/guide)` to link.',
    ].join('\n');

    expect(rewrite(content)).toBe(
      content.replace(
        'See [Install](/pages/docs/guide/install).',
        'See [Install](guide/install.md).',
      ),
    );
  });

  it('handles query strings, single-quoted attributes, angle-bracket targets and reference definitions', () => {
    expect(rewrite('[a](/pages/docs/guide/install?tab=1#linux)')).toBe(
      '[a](guide/install.md#linux)',
    );
    expect(rewrite('[b](/pages/faq?tab=1)')).toBe(
      `[b](${INSTANCE_URL}/pages/faq?tab=1)`,
    );
    expect(rewrite(`![c](/api/media/${MEDIA_ID}/raw?v=2)`)).toBe(
      `![c](_media/${MEDIA_ID}-shot.png)`,
    );
    expect(rewrite("<a href='/pages/docs/guide/install'>d</a>")).toBe(
      "<a href='guide/install.md'>d</a>",
    );
    expect(rewrite('[e](</pages/docs/guide/install>)')).toBe(
      '[e](<guide/install.md>)',
    );
    expect(
      rewrite('[f][ref]\n\n[ref]: /pages/docs/guide/install "Install"'),
    ).toBe('[f][ref]\n\n[ref]: guide/install.md "Install"');
  });

  it('leaves code untouched in indented fences, unterminated fences and multi-backtick spans', () => {
    const indented = '- item\n\n  ```\n  [x](/pages/docs/guide)\n  ```';
    expect(rewrite(indented)).toBe(indented);
    const unterminated = '```\n[x](/pages/docs/guide)\n';
    expect(rewrite(unterminated)).toBe(unterminated);
    const spans =
      'Use `` [x](/pages/docs/guide) `` or `[y](/pages/docs/guide\n)`';
    expect(rewrite(spans)).toBe(spans);
  });

  it('rewrites attributes written with spaces around the equal sign', () => {
    expect(rewrite('<a href = "/pages/docs/guide/install">x</a>')).toBe(
      '<a href = "guide/install.md">x</a>',
    );
  });

  it('only collects media linked from the content itself, not from code or other hosts', () => {
    expect(
      MarkdownLinkRewriter.findMediaIds(
        [
          `![a](/api/media/${MEDIA_ID}/raw)`,
          '```',
          `![b](/api/media/${OTHER_MEDIA_ID}/raw)`,
          '```',
          `![c](https://elsewhere.org/api/media/${OTHER_MEDIA_ID}/raw)`,
        ].join('\n'),
        INSTANCE_URL,
      ),
    ).toEqual([MEDIA_ID]);
  });

  it('scans a long run of backticks in linear time', () => {
    const start = performance.now();
    MarkdownLinkRewriter.findPagePaths('`'.repeat(50_000), INSTANCE_URL);
    expect(performance.now() - start).toBeLessThan(200);
  });

  it('does not treat a lone backtick as code spanning the next paragraphs', () => {
    expect(
      rewrite("It's ` alone\n\n[Install](/pages/docs/guide/install)"),
    ).toBe("It's ` alone\n\n[Install](guide/install.md)");
  });

  describe('findPagePaths', () => {
    function findPagePaths(content: string): string[] {
      return MarkdownLinkRewriter.findPagePaths(content, INSTANCE_URL);
    }

    it('collects the page paths of inline links, reference definitions and HTML attributes', () => {
      expect(
        findPagePaths(
          [
            '[Install](/pages/docs/install)',
            '<a href="/pages/docs/faq">FAQ</a>',
            '[guide]: /pages/docs/guide',
          ].join('\n'),
        ),
      ).toEqual(['/docs/install', '/docs/faq', '/docs/guide']);
    });

    it('treats absolute links to the instance like relative ones and ignores other hosts', () => {
      expect(
        findPagePaths(
          `[a](${INSTANCE_URL}/pages/docs/a) [b](https://elsewhere.org/pages/docs/b)`,
        ),
      ).toEqual(['/docs/a']);
    });

    it('strips the anchor, the query string and trailing slashes', () => {
      expect(
        findPagePaths(
          '[a](/pages/docs/a#setup) [b](/pages/docs/b?tab=1) [c](/pages/docs/c/)',
        ),
      ).toEqual(['/docs/a', '/docs/b', '/docs/c']);
    });

    it('lists each target once', () => {
      expect(
        findPagePaths('[a](/pages/docs/a) [again](/pages/docs/a#other)'),
      ).toEqual(['/docs/a']);
    });

    it('ignores links inside code blocks and inline code', () => {
      expect(
        findPagePaths(
          [
            '`[a](/pages/docs/a)`',
            '```',
            '[b](/pages/docs/b)',
            '```',
            '[c](/pages/docs/c)',
          ].join('\n'),
        ),
      ).toEqual(['/docs/c']);
    });

    it('decodes percent-encoded segments and lowercases the path like slugs', () => {
      expect(findPagePaths('[a](/pages/Docs/caf%C3%A9)')).toEqual([
        '/docs/café',
      ]);
    });

    it('ignores links that do not point to a page', () => {
      expect(
        findPagePaths(
          [
            '[root](/pages/)',
            '[trash](/pages/trash)',
            '[media](/api/media/x/raw)',
            '[anchor](#top)',
            '[broken](/pages/docs/%E0%A4%A)',
          ].join(' '),
        ),
      ).toEqual([]);
    });
  });

  describe('movePagePaths', () => {
    function movePagePaths(content: string) {
      return MarkdownLinkRewriter.movePagePaths(
        content,
        { from: '/docs/guide', to: '/archive/old-guide' },
        INSTANCE_URL,
      );
    }

    it('points links to the moved page and its descendants at their new path', () => {
      expect(
        movePagePaths(
          '[Guide](/pages/docs/guide) [Linux](/pages/docs/guide/install/linux)',
        ),
      ).toEqual({
        content:
          '[Guide](/pages/archive/old-guide) [Linux](/pages/archive/old-guide/install/linux)',
        linksUpdated: 2,
      });
    });

    it('keeps the anchor and the query string', () => {
      expect(
        movePagePaths(
          '[a](/pages/docs/guide#setup) [b](/pages/docs/guide?tab=1#x)',
        ).content,
      ).toBe(
        '[a](/pages/archive/old-guide#setup) [b](/pages/archive/old-guide?tab=1#x)',
      );
    });

    it('keeps absolute links to the instance absolute', () => {
      expect(
        movePagePaths(`[a](${INSTANCE_URL}/pages/docs/guide/install)`).content,
      ).toBe(`[a](${INSTANCE_URL}/pages/archive/old-guide/install)`);
    });

    it('rewrites reference definitions and HTML attributes', () => {
      expect(
        movePagePaths(
          '<a href="/pages/docs/guide">Guide</a>\n[guide]: /pages/docs/guide/install',
        ).content,
      ).toBe(
        '<a href="/pages/archive/old-guide">Guide</a>\n[guide]: /pages/archive/old-guide/install',
      );
    });

    it('matches the path like the link index does', () => {
      expect(
        movePagePaths('[a](/pages/Docs/Guide/) [b](/pages/docs/gu%69de)')
          .content,
      ).toBe('[a](/pages/archive/old-guide) [b](/pages/archive/old-guide)');
    });

    it('keeps the end of the path as the author wrote it', () => {
      expect(
        movePagePaths('[x](/pages/Docs/Guide/Install/My%20Notes#top)').content,
      ).toBe('[x](/pages/archive/old-guide/Install/My%20Notes#top)');
    });

    it('leaves code, other pages and other hosts untouched', () => {
      const content = [
        '`[a](/pages/docs/guide)`',
        '```',
        '[b](/pages/docs/guide)',
        '```',
        '[sibling](/pages/docs/guidelines)',
        '[parent](/pages/docs)',
        '[other](https://elsewhere.org/pages/docs/guide)',
      ].join('\n');

      expect(movePagePaths(content)).toEqual({ content, linksUpdated: 0 });
    });
  });
});
