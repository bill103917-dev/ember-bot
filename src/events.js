import { Events, ActivityType } from "discord.js";
import { commands, handlePollButton, restoreReminders } from "./commands.js";
import { emberEmbed, COLOR_SUCCESS } from "./lib/embeds.js";
import { addXp } from "./lib/xp.js";

export function registerEvents(client) {
  client.on(Events.ClientReady, (readyClient) => {
    console.log(`Ember 已上線：${readyClient.user.tag}`);
    readyClient.user.setActivity("/help", { type: ActivityType.Listening });
    restoreReminders(readyClient);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isButton() && interaction.customId.startsWith("poll:")) {
        await handlePollButton(interaction);
        return;
      }
      if (!interaction.isChatInputCommand()) return;
      const cmd = commands.find((c) => c.data.name === interaction.commandName);
      if (!cmd) return;
      await cmd.execute(interaction);
    } catch (err) {
      console.error(err);
      const payload = { content: "執行指令時發生錯誤。", ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    const channelId = process.env.WELCOME_CHANNEL_ID;
    const channel = channelId
      ? member.guild.channels.cache.get(channelId)
      : member.guild.systemChannel;
    if (!channel?.isTextBased()) return;
    await channel.send({
      embeds: [
        emberEmbed({
          title: `歡迎，${member.user.username}`,
          color: COLOR_SUCCESS,
          description: `${member} 加入了 **${member.guild.name}**。輸入 \`/help\` 看看 Ember 能做什麼。`,
          thumbnail: member.user.displayAvatarURL({ size: 256 }),
        }),
      ],
    });
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    const amount = 15 + Math.floor(Math.random() * 11);
    const result = addXp(message.guild.id, message.author.id, amount);
    if (result.awarded && result.leveled) {
      await message.channel
        .send({
          embeds: [
            emberEmbed({
              title: "升級",
              color: COLOR_SUCCESS,
              description: `${message.author} 升到 **Lv. ${result.level}**。`,
            }),
          ],
        })
        .catch(() => {});
    }
  });
}
