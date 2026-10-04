import { DiscordComponentEmbedDto } from './discord-component-embed.dto.js';

export interface PageMetaDto {
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  discordEmbed: DiscordComponentEmbedDto | null;
}
