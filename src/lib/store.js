import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "data");
const file = path.join(dir, "store.json");

function load() {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return { xp: {}, reminders: [] };
  }
}

const store = load();

export function getStore() {
  return store;
}

export function saveStore() {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(store, null, 2));
}
