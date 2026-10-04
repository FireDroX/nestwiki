import { describe, expect, it } from 'vitest';
import {
  DISCORD_MAX_COMPONENTS,
  DISCORD_MAX_TOTAL_TEXT_LENGTH,
} from '../constants/discord-component.constants.js';
import { DiscordComponentEmbedBuilder } from './discord-component-embed.builder.js';

const ACCENT = 0xec3013;

describe('DiscordComponentEmbedBuilder', () => {
  it('builds a container with a heading text display', () => {
    const embed = new DiscordComponentEmbedBuilder(ACCENT)
      .heading('Patch Notes')
      .build();

    expect(embed).toEqual({
      component: {
        type: 17,
        accent_color: 15478803,
        components: [{ type: 10, content: '# Patch Notes' }],
      },
    });
  });

  it('composes text, separator and link buttons in order', () => {
    const embed = new DiscordComponentEmbedBuilder(ACCENT)
      .heading('Guide')
      .text('Documentation')
      .separator()
      .linkButtons([
        {
          label: 'Ouvrir la page',
          url: 'https://wiki.example.com/pages/guide',
        },
        { label: 'Modifier', url: 'https://wiki.example.com/edit/guide' },
      ])
      .build();

    expect(embed.component.components).toEqual([
      { type: 10, content: '# Guide' },
      { type: 10, content: 'Documentation' },
      { type: 14 },
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: 'Ouvrir la page',
            url: 'https://wiki.example.com/pages/guide',
          },
          {
            type: 2,
            style: 5,
            label: 'Modifier',
            url: 'https://wiki.example.com/edit/guide',
          },
        ],
      },
    ]);
  });

  it('escapes discord markdown coming from user content', () => {
    const embed = new DiscordComponentEmbedBuilder(ACCENT)
      .heading('**bold** [link](https://evil.example) # <@123>')
      .build();

    expect(embed.component.components[0]).toEqual({
      type: 10,
      content:
        '# \\*\\*bold\\*\\* \\[link\\]\\(https\\://evil.example\\) \\# \\<@123\\>',
    });
  });

  it('truncates text to the total text budget with an ellipsis', () => {
    const embed = new DiscordComponentEmbedBuilder(ACCENT)
      .text('a'.repeat(DISCORD_MAX_TOTAL_TEXT_LENGTH + 100))
      .text('dropped once the budget is spent')
      .build();

    expect(embed.component.components).toHaveLength(1);
    const [first] = embed.component.components;
    expect(first.type === 10 && first.content.length).toBe(
      DISCORD_MAX_TOTAL_TEXT_LENGTH,
    );
    expect(first.type === 10 && first.content.endsWith('…')).toBe(true);
  });

  it('ignores non-http, oversized or empty-label buttons', () => {
    const embed = new DiscordComponentEmbedBuilder(ACCENT)
      .linkButtons([
        { label: 'js', url: 'javascript:alert(1)' },
        { label: 'long', url: `https://x.example/${'a'.repeat(600)}` },
        { label: '', url: 'https://x.example' },
      ])
      .build();

    expect(embed.component.components).toEqual([]);
  });

  it('stops adding components past the discord component limit', () => {
    const builder = new DiscordComponentEmbedBuilder(ACCENT);
    for (let i = 0; i < DISCORD_MAX_COMPONENTS + 10; i++) {
      builder.separator();
    }

    expect(builder.build().component.components).toHaveLength(
      DISCORD_MAX_COMPONENTS - 1,
    );
  });
});
