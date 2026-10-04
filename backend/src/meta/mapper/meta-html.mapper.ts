import {
  META_IMAGE_HEIGHT,
  META_IMAGE_WIDTH,
  META_THEME_COLOR,
  SITE_NAME,
} from '../constants/meta.constants.js';
import { PageMetaDto } from '../dto/out/page-meta.dto.js';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export class MetaHtmlMapper {
  static escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
  }

  static toHtml(meta: PageMetaDto): string {
    const title = MetaHtmlMapper.escapeHtml(meta.title);
    const description = MetaHtmlMapper.escapeHtml(meta.description);
    const url = MetaHtmlMapper.escapeHtml(meta.url);
    const imageUrl = MetaHtmlMapper.escapeHtml(meta.imageUrl);

    return [
      '<!doctype html>',
      '<html lang="fr">',
      '<head>',
      '<meta charset="UTF-8" />',
      `<title>${title}</title>`,
      `<meta name="theme-color" content="${META_THEME_COLOR}" />`,
      `<meta name="description" content="${description}" />`,
      '<meta property="og:type" content="website" />',
      `<meta property="og:site_name" content="${SITE_NAME}" />`,
      `<meta property="og:title" content="${title}" />`,
      `<meta property="og:description" content="${description}" />`,
      `<meta property="og:url" content="${url}" />`,
      `<meta property="og:image" content="${imageUrl}" />`,
      `<meta property="og:image:width" content="${META_IMAGE_WIDTH}" />`,
      `<meta property="og:image:height" content="${META_IMAGE_HEIGHT}" />`,
      '<meta name="twitter:card" content="summary_large_image" />',
      `<meta name="twitter:title" content="${title}" />`,
      `<meta name="twitter:description" content="${description}" />`,
      `<meta name="twitter:image" content="${imageUrl}" />`,
      '</head>',
      '<body></body>',
      '</html>',
    ].join('\n');
  }
}
