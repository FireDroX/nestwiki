export const DISCORD_COMPONENT_TYPE = {
  ACTION_ROW: 1,
  BUTTON: 2,
  TEXT_DISPLAY: 10,
  SEPARATOR: 14,
  CONTAINER: 17,
} as const;

export const DISCORD_BUTTON_STYLE_LINK = 5;

export const DISCORD_MAX_TOTAL_TEXT_LENGTH = 4000;

export const DISCORD_MAX_COMPONENTS = 40;

export const DISCORD_MAX_BUTTONS_PER_ROW = 5;

export const DISCORD_MAX_BUTTON_LABEL_LENGTH = 80;

export const DISCORD_MAX_BUTTON_URL_LENGTH = 512;

export const DISCORD_COMPONENT_EMBED_SCRIPT_ID = 'discord:component-embed';

export const DISCORD_COMPONENT_EMBED_MIME_TYPE =
  'application/vnd.discord.component-embed+json';

export const TRUNCATION_ELLIPSIS = '…';
