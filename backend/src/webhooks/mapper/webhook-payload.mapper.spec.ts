import { describe, expect, it } from 'vitest';
import type { WebhookEventPayloadDto } from '../dto/out/webhook-event-payload.dto.js';
import { WebhookPayloadMapper } from './webhook-payload.mapper.js';

interface DiscordBody {
  username: string;
  embeds: Record<string, unknown>[];
}

interface SlackBody {
  text: string;
  blocks: unknown[];
}

function discord(event: WebhookEventPayloadDto): DiscordBody {
  return JSON.parse(
    WebhookPayloadMapper.toBody('discord', event),
  ) as DiscordBody;
}

const payload: WebhookEventPayloadDto = {
  id: 'event-1',
  event: 'page.updated',
  occurredAt: '2026-10-21T10:00:00.000Z',
  instance: { url: 'https://wiki.example.com', version: '1.3.3' },
  actor: { id: 'user-1', displayName: 'Adrien' },
  data: {
    page: {
      id: 'page-1',
      title: 'Guide <installation>',
      path: '/docs/guide',
      url: 'https://wiki.example.com/pages/docs/guide',
    },
    versionId: 'version-2',
    changeSummary: 'Ajout de la section Docker',
  },
};

describe('WebhookPayloadMapper', () => {
  it('sends the event as is in the json format', () => {
    expect(
      JSON.parse(WebhookPayloadMapper.toBody('json', payload)) as unknown,
    ).toEqual(payload);
  });

  it('builds a Discord embed', () => {
    const body = discord(payload);

    expect(body).toEqual({
      username: 'NestWiki',
      embeds: [
        {
          title: 'Page modifiée : Guide <installation>',
          url: 'https://wiki.example.com/pages/docs/guide',
          description: 'Ajout de la section Docker',
          color: 0x3498db,
          author: { name: 'Adrien' },
          footer: { text: 'https://wiki.example.com' },
          timestamp: '2026-10-21T10:00:00.000Z',
        },
      ],
    });
  });

  it('builds a Slack message with escaped mrkdwn', () => {
    const body = JSON.parse(
      WebhookPayloadMapper.toBody('slack', payload),
    ) as SlackBody;

    expect(body.text).toBe('Page modifiée : Guide &lt;installation&gt;');
    expect(body.blocks).toEqual([
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*<https://wiki.example.com/pages/docs/guide|Page modifiée : Guide &lt;installation&gt;>*\nAjout de la section Docker',
        },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: 'Adrien · https://wiki.example.com' },
        ],
      },
    ]);
  });

  it('describes a move with both paths and a deletion with its sub-pages', () => {
    const moved = discord({
      ...payload,
      event: 'page.moved',
      data: {
        page: payload.data.page,
        fromPath: '/docs/guide',
        toPath: '/archive/guide',
      },
    });
    const deleted = discord({
      ...payload,
      event: 'page.deleted',
      data: { page: payload.data.page, descendantCount: 3 },
    });

    expect(moved.embeds[0].description).toBe('/docs/guide → /archive/guide');
    expect(deleted.embeds[0].title).toBe(
      'Page mise à la corbeille : Guide <installation>',
    );
    expect(deleted.embeds[0].description).toBe('Avec 3 sous-pages');
  });

  it('works without a page or an actor', () => {
    const body = discord({
      ...payload,
      event: 'webhook.test',
      actor: null,
      data: { message: 'Ceci est un test.' },
    });

    expect(body.embeds[0]).toEqual({
      title: 'Test du webhook NestWiki',
      description: 'Ceci est un test.',
      color: 0x7f8c8d,
      footer: { text: 'https://wiki.example.com' },
      timestamp: '2026-10-21T10:00:00.000Z',
    });
  });
});
