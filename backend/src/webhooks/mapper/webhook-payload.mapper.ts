import type { WebhookEventPayloadDto } from '../dto/out/webhook-event-payload.dto.js';
import type {
  WebhookDeliveredEvent,
  WebhookFormat,
} from '../entities/webhook.entity.js';

const DISCORD_TITLE_MAX_LENGTH = 256;
const DISCORD_DESCRIPTION_MAX_LENGTH = 4096;

const EVENT_LABELS: Record<WebhookDeliveredEvent, string> = {
  'page.created': 'Page créée',
  'page.updated': 'Page modifiée',
  'page.moved': 'Page déplacée',
  'page.deleted': 'Page mise à la corbeille',
  'page.restored': 'Page restaurée',
  'page.published': 'Page publiée',
  'comment.created': 'Nouveau commentaire',
  'pages.imported': 'Import de pages',
  'webhook.test': 'Test du webhook NestWiki',
};

const EVENT_COLORS: Record<WebhookDeliveredEvent, number> = {
  'page.created': 0x2ecc71,
  'page.updated': 0x3498db,
  'page.moved': 0x9b59b6,
  'page.deleted': 0xe74c3c,
  'page.restored': 0x1abc9c,
  'page.published': 0xe67e22,
  'comment.created': 0x95a5a6,
  'pages.imported': 0x34495e,
  'webhook.test': 0x7f8c8d,
};

export class WebhookPayloadMapper {
  static toBody(
    format: WebhookFormat,
    payload: WebhookEventPayloadDto,
  ): string {
    switch (format) {
      case 'discord':
        return JSON.stringify(WebhookPayloadMapper.toDiscord(payload));
      case 'slack':
        return JSON.stringify(WebhookPayloadMapper.toSlack(payload));
      default:
        return JSON.stringify(payload);
    }
  }

  private static toDiscord(payload: WebhookEventPayloadDto) {
    const description = WebhookPayloadMapper.describe(payload);
    return {
      username: 'NestWiki',
      embeds: [
        {
          title: WebhookPayloadMapper.headline(payload).slice(
            0,
            DISCORD_TITLE_MAX_LENGTH,
          ),
          url: payload.data.page?.url,
          description: description?.slice(0, DISCORD_DESCRIPTION_MAX_LENGTH),
          color: EVENT_COLORS[payload.event],
          author: payload.actor
            ? { name: payload.actor.displayName }
            : undefined,
          footer: { text: payload.instance.url },
          timestamp: payload.occurredAt,
        },
      ],
    };
  }

  private static toSlack(payload: WebhookEventPayloadDto) {
    const headline = WebhookPayloadMapper.escapeMrkdwn(
      WebhookPayloadMapper.headline(payload),
    );
    const description = WebhookPayloadMapper.describe(payload);
    const url = payload.data.page?.url;
    const title = url ? `*<${url}|${headline}>*` : `*${headline}*`;
    return {
      text: headline,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: description
              ? `${title}\n${WebhookPayloadMapper.escapeMrkdwn(description)}`
              : title,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: [payload.actor?.displayName, payload.instance.url]
                .filter(Boolean)
                .map((part) => WebhookPayloadMapper.escapeMrkdwn(part!))
                .join(' · '),
            },
          ],
        },
      ],
    };
  }

  private static headline(payload: WebhookEventPayloadDto): string {
    const label = EVENT_LABELS[payload.event];
    if (payload.event === 'pages.imported') {
      const count = payload.data.pageCount ?? 0;
      return `${label} : ${count} page${count > 1 ? 's' : ''}`;
    }
    return payload.data.page ? `${label} : ${payload.data.page.title}` : label;
  }

  private static describe(payload: WebhookEventPayloadDto): string | undefined {
    const { data } = payload;
    if (data.fromPath && data.toPath) {
      return `${data.fromPath} → ${data.toPath}`;
    }
    if (data.descendantCount) {
      return `Avec ${data.descendantCount} sous-page${data.descendantCount > 1 ? 's' : ''}`;
    }
    return data.changeSummary || data.message || undefined;
  }

  private static escapeMrkdwn(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
