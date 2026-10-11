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
      ),
    ).toEqual([MEDIA_ID, OTHER_MEDIA_ID]);
  });
});
