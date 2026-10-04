import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { emberEmbed, COLOR_DANGER, COLOR_SUCCESS, COLOR_WARN } from "./lib/embeds.js";
import { getXp, leaderboard, xpForLevel } from "./lib/xp.js";
import { getStore, saveStore } from "./lib/store.js";

const EIGHT_BALL = [
  "看起來會順利。",
  "現在先別急，再觀察一下。",
  "機會不小。",
  "答案藏在細節裡。",
  "我傾向贊成。",
  "現階段不太建議。",
  "等一個更好的時機。",
  "如果你已經想清楚了，就去做。",
  "跡象是正面的。",
  "先睡一覺再決定。",
];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

const polls = new Map();

export const commands = [
  {
    data: new SlashCommandBuilder().setName("ping").setDescription("查看機器人往返延遲"),
    async execute(interaction) {
      const sent = await interaction.reply({
        embeds: [emberEmbed({ title: "測量中" })],
        fetchReply: true,
      });
      const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
      await interaction.editReply({
        embeds: [
          emberEmbed({
            title: "連線狀態",
            fields: [
              { name: "往返", value: `${roundtrip}ms`, inline: true },
              { name: "WebSocket", value: `${interaction.client.ws.ping}ms`, inline: true },
            ],
          }),
        ],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("help")
      .setDescription("列出斜線指令")
      .addStringOption((o) =>
        o
          .setName("分類")
          .setDescription("篩選分類")
          .addChoices(
            { name: "一般", value: "general" },
            { name: "娛樂", value: "fun" },
            { name: "社群", value: "community" },
            { name: "管理", value: "mod" },
          ),
      ),
    async execute(interaction) {
      const cat = interaction.options.getString("分類");
      const groups = {
        general: ["ping", "help", "userinfo", "serverinfo", "avatar", "ask"],
        fun: ["8ball", "dice", "choose", "coinflip", "rps"],
        community: ["poll", "remind", "rank", "leaderboard"],
        mod: ["timeout", "kick", "ban", "clear", "slowmode", "announce"],
      };
      const labels = { general: "一般", fun: "娛樂", community: "社群", mod: "管理" };
      const keys = cat ? [cat] : Object.keys(groups);
      const fields = keys.map((key) => ({
        name: labels[key],
        value: groups[key].map((n) => `\`/${n}\``).join("  "),
      }));
      await interaction.reply({
        embeds: [
          emberEmbed({
            title: "星火指令",
            description: "在對話框輸入 `/` 即可呼叫。管理指令需要對應權限。",
            fields,
          }),
        ],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("userinfo")
      .setDescription("查看成員資料卡")
      .addUserOption((o) => o.setName("成員").setDescription("要查看的成員")),
    async execute(interaction) {
      const user = interaction.options.getUser("成員") ?? interaction.user;
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      const roles = member
        ? member.roles.cache
            .filter((r) => r.id !== interaction.guild.id)
            .sort((a, b) => b.position - a.position)
            .map((r) => r.toString())
            .slice(0, 12)
        : [];
      await interaction.reply({
        embeds: [
          emberEmbed({
            title: user.username,
            thumbnail: user.displayAvatarURL({ size: 256 }),
            fields: [
              { name: "ID", value: user.id, inline: true },
              {
                name: "加入",
                value: member?.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : "—",
                inline: true,
              },
              { name: "身分組", value: roles.join(" ") || "無" },
            ],
          }),
        ],
      });
    },
  },
  {
    data: new SlashCommandBuilder().setName("serverinfo").setDescription("查看伺服器概況"),
    async execute(interaction) {
      const g = interaction.guild;
      await interaction.reply({
        embeds: [
          emberEmbed({
            title: g.name,
            thumbnail: g.iconURL({ size: 256 }) ?? undefined,
            fields: [
              { name: "成員", value: String(g.memberCount), inline: true },
              { name: "加成", value: `Lv. ${g.premiumTier}`, inline: true },
              {
                name: "建立",
                value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`,
                inline: true,
              },
            ],
          }),
        ],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("avatar")
      .setDescription("取得成員頭像")
      .addUserOption((o) => o.setName("成員").setDescription("目標")),
    async execute(interaction) {
      const user = interaction.options.getUser("成員") ?? interaction.user;
      const url = user.displayAvatarURL({ size: 1024 });
      await interaction.reply({
        embeds: [emberEmbed({ title: `${user.username} 的頭像`, image: url, description: url })],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("ask")
      .setDescription("向 Ember 提問（需要 XAI_API_KEY）")
      .addStringOption((o) => o.setName("問題").setDescription("想問的事").setRequired(true).setMaxLength(400)),
    async execute(interaction) {
      const key = process.env.XAI_API_KEY;
      if (!key) {
        await interaction.reply({ content: "尚未設定 XAI_API_KEY，無法使用問答。", ephemeral: true });
        return;
      }
      const prompt = interaction.options.getString("問題", true);
      await interaction.deferReply();
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          max_tokens: 280,
          temperature: 0.7,
          messages: [
            {
              role: "system",
              content:
                "你是 Ember（星火），一個簡潔、沉穩的 Discord 社群助手。用繁體中文回答，除非對方用其他語言。不要用表情符號。回答控制在 120 字以內。",
            },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!res.ok) {
        await interaction.editReply({ content: "目前無法連上 Ember。" });
        return;
      }
      const body = await res.json();
      const text = body.choices?.[0]?.message?.content?.trim() || "沒有得到回答。";
      await interaction.editReply({
        embeds: [emberEmbed({ title: "Ember", description: text, footer: prompt })],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("8ball")
      .setDescription("問一件事，給一個答案")
      .addStringOption((o) => o.setName("問題").setDescription("你想問的事").setRequired(true)),
    async execute(interaction) {
      const q = interaction.options.getString("問題", true);
      await interaction.reply({
        embeds: [
          emberEmbed({
            title: "占卜",
            fields: [
              { name: "問題", value: q },
              { name: "回答", value: pick(EIGHT_BALL) },
            ],
          }),
        ],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("dice")
      .setDescription("擲骰。支援 NdS，例如 2d6")
      .addStringOption((o) => o.setName("骰子").setDescription("例如 1d20 或 2d6")),
    async execute(interaction) {
      const expr = (interaction.options.getString("骰子") ?? "1d20").toLowerCase();
      const m = expr.match(/^(\d{1,2})d(\d{1,3})$/);
      if (!m) {
        await interaction.reply({ content: "格式需為 NdS，例如 `2d6` 或 `1d20`。", ephemeral: true });
        return;
      }
      const n = Number(m[1]);
      const sides = Number(m[2]);
      if (n < 1 || n > 20 || sides < 2 || sides > 1000) {
        await interaction.reply({ content: "骰子數量 1–20，面數 2–1000。", ephemeral: true });
        return;
      }
      const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * sides));
      const total = rolls.reduce((a, b) => a + b, 0);
      await interaction.reply({
        embeds: [
          emberEmbed({
            title: `${n}d${sides}`,
            description: n > 1 ? `點數：${rolls.join(" + ")} = **${total}**` : `點數：**${total}**`,
          }),
        ],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("choose")
      .setDescription("從幾個選項裡幫你挑一個")
      .addStringOption((o) =>
        o.setName("選項").setDescription("用空格或 | 分隔").setRequired(true),
      ),
    async execute(interaction) {
      const raw = interaction.options.getString("選項", true);
      const options = raw.split(/[|]/).flatMap((s) => s.trim().split(/\s+/)).filter(Boolean);
      if (options.length < 2) {
        await interaction.reply({ content: "至少給兩個選項。", ephemeral: true });
        return;
      }
      const choice = pick(options);
      await interaction.reply({
        embeds: [
          emberEmbed({
            title: "抽籤",
            description: `從 ${options.map((a) => `「${a}」`).join("、")} 裡，選 **${choice}**。`,
          }),
        ],
      });
    },
  },
  {
    data: new SlashCommandBuilder().setName("coinflip").setDescription("擲一枚硬幣"),
    async execute(interaction) {
      await interaction.reply({
        embeds: [emberEmbed({ title: "擲硬幣", description: Math.random() < 0.5 ? "**正面**" : "**反面**" })],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("rps")
      .setDescription("和 Ember 猜拳")
      .addStringOption((o) =>
        o
          .setName("出拳")
          .setDescription("石頭、布或剪刀")
          .setRequired(true)
          .addChoices(
            { name: "石頭", value: "rock" },
            { name: "布", value: "paper" },
            { name: "剪刀", value: "scissors" },
          ),
      ),
    async execute(interaction) {
      const you = interaction.options.getString("出拳", true);
      const bot = pick(["rock", "paper", "scissors"]);
      const label = { rock: "石頭", paper: "布", scissors: "剪刀" };
      const win =
        (you === "rock" && bot === "scissors") ||
        (you === "paper" && bot === "rock") ||
        (you === "scissors" && bot === "paper");
      const draw = you === bot;
      await interaction.reply({
        embeds: [
          emberEmbed({
            title: "猜拳",
            fields: [
              { name: "你", value: label[you], inline: true },
              { name: "Ember", value: label[bot], inline: true },
              { name: "結果", value: draw ? "平手" : win ? "你贏了" : "Ember 贏了" },
            ],
          }),
        ],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("poll")
      .setDescription("建立投票。用 | 分隔選項")
      .addStringOption((o) =>
        o.setName("內容").setDescription("題目 | 選項1 | 選項2").setRequired(true),
      ),
    async execute(interaction) {
      const parts = interaction.options
        .getString("內容", true)
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length < 3 || parts.length > 6) {
        await interaction.reply({
          content: "格式：`題目 | 選項1 | 選項2`，選項 2–5 個。",
          ephemeral: true,
        });
        return;
      }
      const [question, ...options] = parts;
      const id = `${interaction.id}`;
      const votes = options.map(() => new Set());
      polls.set(id, { options, votes });
      const row = new ActionRowBuilder().addComponents(
        ...options.map((opt, i) =>
          new ButtonBuilder()
            .setCustomId(`poll:${id}:${i}`)
            .setLabel(opt.slice(0, 80))
            .setStyle(ButtonStyle.Secondary),
        ),
      );
      await interaction.reply({
        embeds: [
          emberEmbed({
            title: "投票",
            description: question,
            fields: options.map((opt, i) => ({ name: opt, value: "0 票", inline: true })),
            footer: `發起人 ${interaction.user.username}`,
          }),
        ],
        components: [row],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("remind")
      .setDescription("幾分鐘後提醒你")
      .addIntegerOption((o) =>
        o.setName("分鐘").setDescription("1–1440").setRequired(true).setMinValue(1).setMaxValue(1440),
      )
      .addStringOption((o) => o.setName("內容").setDescription("要提醒的事").setRequired(true)),
    async execute(interaction) {
      const minutes = interaction.options.getInteger("分鐘", true);
      const text = interaction.options.getString("內容", true);
      const when = Date.now() + minutes * 60_000;
      const store = getStore();
      store.reminders.push({
        userId: interaction.user.id,
        channelId: interaction.channelId,
        text,
        when,
      });
      saveStore();
      scheduleReminder(interaction.client, store.reminders.at(-1));
      await interaction.reply({
        embeds: [
          emberEmbed({
            title: "已排程",
            color: COLOR_SUCCESS,
            description: `會在 <t:${Math.floor(when / 1000)}:R> 提醒你：${text}`,
          }),
        ],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("rank")
      .setDescription("查看你的等級與經驗")
      .addUserOption((o) => o.setName("成員").setDescription("目標")),
    async execute(interaction) {
      const user = interaction.options.getUser("成員") ?? interaction.user;
      const row = getXp(interaction.guildId, user.id);
      const next = xpForLevel(row.level + 1);
      const board = leaderboard(interaction.guildId, 50);
      const rank = board.findIndex((e) => e.userId === user.id) + 1;
      await interaction.reply({
        embeds: [
          emberEmbed({
            title: `${user.username} 的等級`,
            fields: [
              { name: "等級", value: `Lv. ${row.level}`, inline: true },
              { name: "經驗", value: `${row.total} XP`, inline: true },
              { name: "排名", value: rank ? `#${rank}` : "尚未上榜", inline: true },
              { name: "下一級", value: `${next} XP` },
            ],
          }),
        ],
      });
    },
  },
  {
    data: new SlashCommandBuilder().setName("leaderboard").setDescription("伺服器經驗排行"),
    async execute(interaction) {
      const board = leaderboard(interaction.guildId, 10);
      if (!board.length) {
        await interaction.reply({ content: "還沒有經驗紀錄。先在頻道裡聊幾句。", ephemeral: true });
        return;
      }
      const lines = await Promise.all(
        board.map(async (row, i) => {
          const user = await interaction.client.users.fetch(row.userId).catch(() => null);
          const name = user?.username ?? row.userId;
          return `**#${i + 1} ${name}** — Lv. ${row.level} · ${row.total} XP`;
        }),
      );
      await interaction.reply({
        embeds: [
          emberEmbed({
            title: "經驗排行",
            description: lines.join("\n"),
            footer: interaction.guild.name,
          }),
        ],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("timeout")
      .setDescription("將成員禁言一段時間")
      .addUserOption((o) => o.setName("成員").setDescription("目標").setRequired(true))
      .addIntegerOption((o) =>
        o.setName("分鐘").setDescription("1–10080").setRequired(true).setMinValue(1).setMaxValue(10080),
      )
      .addStringOption((o) => o.setName("原因").setDescription("紀錄用"))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
      const user = interaction.options.getUser("成員", true);
      const minutes = interaction.options.getInteger("分鐘", true);
      const reason = interaction.options.getString("原因") ?? "未填寫";
      const member = await interaction.guild.members.fetch(user.id);
      await member.timeout(minutes * 60_000, reason);
      await interaction.reply({
        embeds: [
          emberEmbed({
            title: "已禁言",
            color: COLOR_WARN,
            fields: [
              { name: "成員", value: `${user}`, inline: true },
              { name: "時長", value: `${minutes} 分鐘`, inline: true },
              { name: "原因", value: reason },
            ],
          }),
        ],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("kick")
      .setDescription("將成員踢出伺服器")
      .addUserOption((o) => o.setName("成員").setDescription("目標").setRequired(true))
      .addStringOption((o) => o.setName("原因").setDescription("紀錄用"))
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    async execute(interaction) {
      const user = interaction.options.getUser("成員", true);
      const reason = interaction.options.getString("原因") ?? "未填寫";
      const member = await interaction.guild.members.fetch(user.id);
      await member.kick(reason);
      await interaction.reply({
        embeds: [
          emberEmbed({
            title: "已踢出",
            color: COLOR_DANGER,
            description: `${user} 已被踢出。原因：${reason}`,
          }),
        ],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("ban")
      .setDescription("將成員停權")
      .addUserOption((o) => o.setName("成員").setDescription("目標").setRequired(true))
      .addStringOption((o) => o.setName("原因").setDescription("紀錄用"))
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    async execute(interaction) {
      const user = interaction.options.getUser("成員", true);
      const reason = interaction.options.getString("原因") ?? "未填寫";
      await interaction.guild.members.ban(user, { reason });
      await interaction.reply({
        embeds: [
          emberEmbed({
            title: "已停權",
            color: COLOR_DANGER,
            description: `${user} 已被停權。原因：${reason}`,
          }),
        ],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("clear")
      .setDescription("清除頻道中最近的訊息")
      .addIntegerOption((o) =>
        o.setName("數量").setDescription("1–100").setRequired(true).setMinValue(1).setMaxValue(100),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
      const n = interaction.options.getInteger("數量", true);
      const deleted = await interaction.channel.bulkDelete(n, true);
      await interaction.reply({
        embeds: [
          emberEmbed({
            title: "已清除",
            color: COLOR_SUCCESS,
            description: `刪除了 **${deleted.size}** 則訊息。`,
          }),
        ],
        ephemeral: true,
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("slowmode")
      .setDescription("設定頻道慢速模式")
      .addIntegerOption((o) =>
        o.setName("秒數").setDescription("0 表示關閉").setRequired(true).setMinValue(0).setMaxValue(21600),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
      const n = interaction.options.getInteger("秒數", true);
      await interaction.channel.setRateLimitPerUser(n);
      await interaction.reply({
        embeds: [
          emberEmbed({
            title: "慢速模式",
            description: n === 0 ? "已關閉。" : `成員需間隔 **${n}** 秒才能再發言。`,
          }),
        ],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("announce")
      .setDescription("發送一則公告嵌入訊息")
      .addStringOption((o) => o.setName("內容").setDescription("公告文字").setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.MentionEveryone),
    async execute(interaction) {
      const text = interaction.options.getString("內容", true);
      await interaction.reply({
        embeds: [
          emberEmbed({
            title: "公告",
            description: text,
            footer: `來自 ${interaction.user.username}`,
          }),
        ],
      });
    },
  },
];

export async function handlePollButton(interaction) {
  const [, id, indexRaw] = interaction.customId.split(":");
  const poll = polls.get(id);
  if (!poll) {
    await interaction.reply({ content: "這則投票已過期。", ephemeral: true });
    return;
  }
  const index = Number(indexRaw);
  if (!poll.votes[index]) {
    await interaction.reply({ content: "無效的選項。", ephemeral: true });
    return;
  }
  for (const set of poll.votes) set.delete(interaction.user.id);
  poll.votes[index].add(interaction.user.id);
  const embed = emberEmbed({
    title: interaction.message.embeds[0]?.title ?? "投票",
    description: interaction.message.embeds[0]?.description ?? "",
    fields: poll.options.map((opt, i) => ({
      name: opt,
      value: `${poll.votes[i].size} 票`,
      inline: true,
    })),
    footer: interaction.message.embeds[0]?.footer?.text,
  });
  await interaction.update({ embeds: [embed], components: interaction.message.components });
}

export function scheduleReminder(client, reminder) {
  const delay = Math.max(0, reminder.when - Date.now());
  if (delay > 2_147_000_000) return;
  setTimeout(async () => {
    try {
      const channel = await client.channels.fetch(reminder.channelId);
      if (channel?.isTextBased()) {
        await channel.send({
          content: `<@${reminder.userId}> 提醒：${reminder.text}`,
        });
      }
    } catch (err) {
      console.error("reminder failed", err);
    }
    const store = getStore();
    store.reminders = store.reminders.filter((r) => r !== reminder);
    saveStore();
  }, delay);
}

export function restoreReminders(client) {
  const now = Date.now();
  const store = getStore();
  store.reminders = store.reminders.filter((r) => r.when > now - 60_000);
  saveStore();
  for (const r of store.reminders) scheduleReminder(client, r);
}
