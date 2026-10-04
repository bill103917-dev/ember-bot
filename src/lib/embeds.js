import { EmbedBuilder } from "discord.js";

export const COLOR = 0xc8ccd4;
export const COLOR_DANGER = 0xc45c5c;
export const COLOR_SUCCESS = 0x6f9e7c;
export const COLOR_WARN = 0xc4a06a;

export function emberEmbed(options = {}) {
  const embed = new EmbedBuilder().setColor(options.color ?? COLOR).setTimestamp();
  if (options.title) embed.setTitle(options.title);
  if (options.description) embed.setDescription(options.description);
  if (options.fields?.length) embed.addFields(options.fields);
  if (options.footer) embed.setFooter({ text: options.footer });
  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  if (options.image) embed.setImage(options.image);
  return embed;
}
