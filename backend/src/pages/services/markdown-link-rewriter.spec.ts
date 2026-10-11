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

  it('does not treat a lone backtick as code spanning the next paragraphs', () => {
    expect(
      rewrite("It's ` alone\n\n[Install](/pages/docs/guide/install)"),
    ).toBe("It's ` alone\n\n[Install](guide/install.md)");
  });
});
