import "dotenv/config";
import http from "node:http";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { registerEvents } from "./events.js";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("缺少 DISCORD_TOKEN。請在環境變數或 .env 中設定。");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

registerEvents(client);

const port = process.env.PORT;
if (port) {
  http
    .createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("ember ok");
    })
    .listen(Number(port), "0.0.0.0");
}

client.login(token);
