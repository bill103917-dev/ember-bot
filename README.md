# 星火 Ember

Discord 社群機器人：斜線指令、管理、等級、投票、可選 Grok 問答。

倉庫：https://github.com/bill103917-dev/ember-bot

## 功能

- 一般：`/ping` `/help` `/userinfo` `/serverinfo` `/avatar` `/ask`
- 娛樂：`/8ball` `/dice` `/choose` `/coinflip` `/rps`
- 社群：`/poll` `/remind` `/rank` `/leaderboard`
- 管理：`/timeout` `/kick` `/ban` `/clear` `/slowmode` `/announce`
- 成員加入時發送歡迎嵌入訊息
- 發言累積經驗（每則冷卻 60 秒）

## 環境變數

複製 `.env.example` 為 `.env`，或在託管平台填入：

| 變數 | 必填 | 說明 |
| --- | --- | --- |
| `DISCORD_TOKEN` | 是 | Bot Token |
| `CLIENT_ID` | 是 | Application ID |
| `GUILD_ID` | 否 | 指定伺服器可立刻出現斜線指令 |
| `WELCOME_CHANNEL_ID` | 否 | 歡迎頻道，未填則用系統頻道 |
| `XAI_API_KEY` | 否 | 開啟 `/ask` |
| `PORT` | 否 | 若平台要求 HTTP 健康檢查會自動開 |

## Discord 設定

1. [開發者入口](https://discord.com/developers/applications) 新增 Application
2. Bot 頁面建立機器人，複製 Token
3. 打開 **Server Members Intent** 與 **Message Content Intent**
4. OAuth2 → URL Generator：scopes 勾 `bot` 與 `applications.commands`

邀請連結範例（把 `CLIENT_ID` 換掉）：

```
https://discord.com/oauth2/authorize?client_id=CLIENT_ID&permissions=1135341647878&scope=bot%20applications.commands
```

## 啟動

本機：

```bash
npm install
npm run deploy
npm start
```

Railway / Render：連接此倉庫，填環境變數，Build 用 `npm install`，Start 用 `npm start`。第一次部署後在平台跑一次 `npm run deploy` 註冊斜線指令。

Docker：

```bash
docker build -t ember-bot .
docker run --env-file .env ember-bot
```

## 授權

MIT
