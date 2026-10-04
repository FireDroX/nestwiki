import { DiscordComponentEmbedBuilder } from './discord-component-embed.builder.js';
import {
  BREADCRUMB_SEPARATOR,
  EDIT_PAGE_BUTTON_LABEL,
  META_ACCENT_COLOR,
  META_LIST_SEPARATOR,
  META_LOCALE,
  META_MAX_TAGS,
  META_TIME_ZONE,
  OPEN_PAGE_BUTTON_LABEL,
} from '../constants/meta.constants.js';
import { DiscordComponentEmbedDto } from '../dto/out/discord-component-embed.dto.js';
import { PageCardDto } from '../dto/out/page-card.dto.js';

const numberFormat = new Intl.NumberFormat(META_LOCALE);

const dateFormat = new Intl.DateTimeFormat(META_LOCALE, {
  dateStyle: 'long',
  timeZone: META_TIME_ZONE,
});

export class PageCardMapper {
  static toDescription(card: PageCardDto): string {
    return [
      PageCardMapper.breadcrumb(card),
      card.tagNames.length > 0
        ? PageCardMapper.count(card.tagNames.length, 'tag', 'tags')
        : null,
      PageCardMapper.count(card.stats.viewCount, 'vue', 'vues'),
    ]
      .filter((part): part is string => part !== null)
      .join(META_LIST_SEPARATOR);
  }

  static toDiscordEmbed(card: PageCardDto): DiscordComponentEmbedDto {
    const builder = new DiscordComponentEmbedBuilder(META_ACCENT_COLOR).heading(
      card.title,
    );

    if (card.ancestorTitles.length > 0) {
      builder.text(PageCardMapper.breadcrumb(card));
    }
    if (card.tagNames.length > 0) {
      builder.text(`🏷 ${PageCardMapper.tagList(card.tagNames)}`);
    }

    return builder
      .separator()
      .text(PageCardMapper.statsLine(card))
      .text(PageCardMapper.lastModifiedLine(card))
      .linkButtons([
        { label: OPEN_PAGE_BUTTON_LABEL, url: card.pageUrl },
        { label: EDIT_PAGE_BUTTON_LABEL, url: card.editUrl },
      ])
      .build();
  }

  private static breadcrumb(card: PageCardDto): string {
    return [...card.ancestorTitles, card.title].join(BREADCRUMB_SEPARATOR);
  }

  private static tagList(tagNames: string[]): string {
    const shown = tagNames.slice(0, META_MAX_TAGS).join(META_LIST_SEPARATOR);
    const hiddenCount = tagNames.length - META_MAX_TAGS;
    return hiddenCount > 0 ? `${shown} +${hiddenCount}` : shown;
  }

  private static statsLine(card: PageCardDto): string {
    const { viewCount, versionsCount, commentsCount, contributorsCount } =
      card.stats;
    return [
      `👁 ${PageCardMapper.count(viewCount, 'vue', 'vues')}`,
      `✏️ ${PageCardMapper.count(versionsCount, 'version', 'versions')}`,
      `💬 ${PageCardMapper.count(commentsCount, 'commentaire', 'commentaires')}`,
      `👥 ${PageCardMapper.count(contributorsCount, 'contributeur', 'contributeurs')}`,
    ].join(META_LIST_SEPARATOR);
  }

  private static lastModifiedLine(card: PageCardDto): string {
    const date = dateFormat.format(card.stats.lastModifiedAt);
    const author = card.stats.lastModifiedBy?.displayName;
    return author
      ? `🕒 Modifiée le ${date} par ${author}`
      : `🕒 Modifiée le ${date}`;
  }

  private static count(
    value: number,
    singular: string,
    plural: string,
  ): string {
    return `${numberFormat.format(value)} ${value > 1 ? plural : singular}`;
  }
}
