export interface DiscordTextDisplay {
  type: 10;
  content: string;
}

export interface DiscordSeparator {
  type: 14;
}

export interface DiscordLinkButton {
  type: 2;
  style: 5;
  label: string;
  url: string;
}

export interface DiscordActionRow {
  type: 1;
  components: DiscordLinkButton[];
}

export type DiscordContainerChild =
  DiscordTextDisplay | DiscordSeparator | DiscordActionRow;

export interface DiscordContainer {
  type: 17;
  accent_color: number;
  components: DiscordContainerChild[];
}

export interface DiscordComponentEmbedDto {
  component: DiscordContainer;
}
