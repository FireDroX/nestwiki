import { describe, expect, it } from 'vitest';
import { MetaHtmlMapper } from './meta-html.mapper.js';

describe('MetaHtmlMapper', () => {
  it('renders open graph and twitter tags', () => {
    const html = MetaHtmlMapper.toHtml({
      title: 'Guide — OpenWiki',
      description: 'Documentation › Guide',
      url: 'https://wiki.example.com/pages/docs/guide',
      imageUrl: 'https://wiki.example.com/og-image.png',
    });

    expect(html).toContain(
      '<meta property="og:title" content="Guide — OpenWiki" />',
    );
    expect(html).toContain(
      '<meta property="og:url" content="https://wiki.example.com/pages/docs/guide" />',
    );
    expect(html).toContain(
      '<meta property="og:image" content="https://wiki.example.com/og-image.png" />',
    );
    expect(html).toContain(
      '<meta name="twitter:card" content="summary_large_image" />',
    );
    expect(html).toContain('<meta property="og:image:width" content="1200" />');
  });

  it('escapes html special characters coming from page content', () => {
    const html = MetaHtmlMapper.toHtml({
      title: '"><script>alert(1)</script> & co',
      description: "it's <b>bold</b>",
      url: 'https://wiki.example.com/pages/x',
      imageUrl: 'https://wiki.example.com/og-image.png',
    });

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>');
    expect(html).toContain(
      '&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt; &amp; co',
    );
    expect(html).toContain('it&#39;s &lt;b&gt;bold&lt;/b&gt;');
  });
});
