import "dotenv/config";
import { REST, Routes } from "discord.js";
import { commands } from "./commands.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error("需要 DISCORD_TOKEN 與 CLIENT_ID。");
  process.exit(1);
}

const body = commands.map((c) => c.data.toJSON());
const rest = new REST({ version: "10" }).setToken(token);

try {
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
    console.log(`已註冊 ${body.length} 道伺服器指令。`);
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body });
    console.log(`已註冊 ${body.length} 道全域指令（最多約一小時生效）。`);
  }
} catch (err) {
  console.error(err);
  process.exit(1);
}
