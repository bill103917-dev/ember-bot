import { getStore, saveStore } from "./store.js";

const COOLDOWN_MS = 60_000;

export function xpForLevel(level) {
  return 5 * level * level + 50 * level;
}

export function levelFromXp(total) {
  let level = 0;
  while (xpForLevel(level + 1) <= total) level += 1;
  return level;
}

function key(guildId, userId) {
  return `${guildId}:${userId}`;
}

export function addXp(guildId, userId, amount) {
  const store = getStore();
  const k = key(guildId, userId);
  if (!store.xp[k]) store.xp[k] = { total: 0, last: 0 };
  const now = Date.now();
  if (now - store.xp[k].last < COOLDOWN_MS) return { awarded: false, ...store.xp[k] };
  const before = levelFromXp(store.xp[k].total);
  store.xp[k].total += amount;
  store.xp[k].last = now;
  saveStore();
  const after = levelFromXp(store.xp[k].total);
  return { awarded: true, leveled: after > before, level: after, ...store.xp[k] };
}

export function getXp(guildId, userId) {
  const row = getStore().xp[key(guildId, userId)] ?? { total: 0, last: 0 };
  return { ...row, level: levelFromXp(row.total) };
}

export function leaderboard(guildId, limit = 10) {
  const prefix = `${guildId}:`;
  return Object.entries(getStore().xp)
    .filter(([k]) => k.startsWith(prefix))
    .map(([k, v]) => ({ userId: k.slice(prefix.length), total: v.total, level: levelFromXp(v.total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}
