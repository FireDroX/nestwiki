import { describe, expect, it } from 'vitest';
import { PageMetaDto } from '../dto/out/page-meta.dto.js';
import { MetaHtmlMapper } from './meta-html.mapper.js';

const LINE_SEPARATOR = String.fromCharCode(0x2028);

function buildMeta(overrides: Partial<PageMetaDto> = {}): PageMetaDto {
  return {
    title: 'Guide — NestWiki',
    description: 'Documentation › Guide',
    url: 'https://wiki.example.com/pages/docs/guide',
    imageUrl: 'https://wiki.example.com/og-image.png',
    discordEmbed: null,
    ...overrides,
  };
}

describe('MetaHtmlMapper', () => {
  it('renders open graph and twitter tags', () => {
    const html = MetaHtmlMapper.toHtml(buildMeta());

    expect(html).toContain(
      '<meta property="og:title" content="Guide — NestWiki" />',
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
    const html = MetaHtmlMapper.toHtml(
      buildMeta({
        title: '"><script>alert(1)</script> & co',
        description: "it's <b>bold</b>",
      }),
    );

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>');
    expect(html).toContain(
      '&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt; &amp; co',
    );
    expect(html).toContain('it&#39;s &lt;b&gt;bold&lt;/b&gt;');
  });

  it('omits the discord component script when there is no embed', () => {
    const html = MetaHtmlMapper.toHtml(buildMeta());

    expect(html).not.toContain('discord:component-embed');
  });

  it('injects the discord component script with a parseable payload', () => {
    const embed = {
      component: {
        type: 17 as const,
        accent_color: 0xec3013,
        components: [{ type: 10 as const, content: '# Guide' }],
      },
    };

    const html = MetaHtmlMapper.toHtml(buildMeta({ discordEmbed: embed }));

    const match = html.match(
      /<script id="discord:component-embed" type="application\/vnd\.discord\.component-embed\+json">\n(.*)\n<\/script>/,
    );
    expect(match).not.toBeNull();
    expect(JSON.parse(match![1])).toEqual(embed);
  });

  it('cannot be broken out of by a closing script tag in the payload', () => {
    const embed = {
      component: {
        type: 17 as const,
        accent_color: 0,
        components: [
          {
            type: 10 as const,
            content: '</script><script>alert(1)</script><!-- ' + LINE_SEPARATOR,
          },
        ],
      },
    };

    const html = MetaHtmlMapper.toHtml(buildMeta({ discordEmbed: embed }));

    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(html).not.toContain('<!--');
    expect(html).not.toContain(LINE_SEPARATOR);
    const payload = html.split('\n').find((line) => line.startsWith('{'))!;
    expect(JSON.parse(payload)).toEqual(embed);
  });
});
