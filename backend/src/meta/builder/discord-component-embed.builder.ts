import {
  DISCORD_BUTTON_STYLE_LINK,
  DISCORD_COMPONENT_TYPE,
  DISCORD_MAX_BUTTON_LABEL_LENGTH,
  DISCORD_MAX_BUTTON_URL_LENGTH,
  DISCORD_MAX_BUTTONS_PER_ROW,
  DISCORD_MAX_COMPONENTS,
  DISCORD_MAX_TOTAL_TEXT_LENGTH,
  TRUNCATION_ELLIPSIS,
} from '../constants/discord-component.constants.js';
import {
  DiscordComponentEmbedDto,
  DiscordContainerChild,
  DiscordLinkButton,
} from '../dto/out/discord-component-embed.dto.js';

const DISCORD_MARKDOWN_CHARACTERS = /[\\*_`~|>#[\]()<:-]/g;

export interface LinkButtonInput {
  label: string;
  url: string;
}

export class DiscordComponentEmbedBuilder {
  private readonly children: DiscordContainerChild[] = [];
  private remainingTextLength = DISCORD_MAX_TOTAL_TEXT_LENGTH;
  private componentCount = 1;

  constructor(private readonly accentColor: number) {}

  static escapeMarkdown(value: string): string {
    return value.replace(DISCORD_MARKDOWN_CHARACTERS, (char) => `\\${char}`);
  }

  static truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }
    if (maxLength <= TRUNCATION_ELLIPSIS.length) {
      return TRUNCATION_ELLIPSIS.slice(0, maxLength);
    }
    return `${value.slice(0, maxLength - TRUNCATION_ELLIPSIS.length).trimEnd()}${TRUNCATION_ELLIPSIS}`;
  }

  heading(title: string): this {
    return this.markdown(
      `# ${DiscordComponentEmbedBuilder.escapeMarkdown(title)}`,
    );
  }

  text(value: string): this {
    return this.markdown(DiscordComponentEmbedBuilder.escapeMarkdown(value));
  }

  markdown(content: string): this {
    if (this.remainingTextLength === 0 || !this.reserveComponents(1)) {
      return this;
    }
    const truncated = DiscordComponentEmbedBuilder.truncate(
      content,
      this.remainingTextLength,
    );
    this.remainingTextLength -= truncated.length;
    this.children.push({
      type: DISCORD_COMPONENT_TYPE.TEXT_DISPLAY,
      content: truncated,
    });
    return this;
  }

  separator(): this {
    if (this.reserveComponents(1)) {
      this.children.push({ type: DISCORD_COMPONENT_TYPE.SEPARATOR });
    }
    return this;
  }

  linkButtons(buttons: LinkButtonInput[]): this {
    const validButtons = buttons
      .filter(
        (button) =>
          button.label.length > 0 &&
          button.url.length <= DISCORD_MAX_BUTTON_URL_LENGTH &&
          /^https?:\/\//.test(button.url),
      )
      .slice(0, DISCORD_MAX_BUTTONS_PER_ROW);
    if (
      validButtons.length === 0 ||
      !this.reserveComponents(validButtons.length + 1)
    ) {
      return this;
    }
    this.children.push({
      type: DISCORD_COMPONENT_TYPE.ACTION_ROW,
      components: validButtons.map((button): DiscordLinkButton => ({
        type: DISCORD_COMPONENT_TYPE.BUTTON,
        style: DISCORD_BUTTON_STYLE_LINK,
        label: DiscordComponentEmbedBuilder.truncate(
          button.label,
          DISCORD_MAX_BUTTON_LABEL_LENGTH,
        ),
        url: button.url,
      })),
    });
    return this;
  }

  build(): DiscordComponentEmbedDto {
    return {
      component: {
        type: DISCORD_COMPONENT_TYPE.CONTAINER,
        accent_color: this.accentColor,
        components: [...this.children],
      },
    };
  }

  private reserveComponents(count: number): boolean {
    if (this.componentCount + count > DISCORD_MAX_COMPONENTS) {
      return false;
    }
    this.componentCount += count;
    return true;
  }
}
