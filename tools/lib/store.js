// Load/save data/calendar.json (schema version 7) + item helpers.
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_DATA = path.join(ROOT, "data", "calendar.json");
const ACTIVITY = path.join(ROOT, "data", "activity.jsonl");

function nowISO() { return new Date().toISOString(); }

// Same id generator as app.js uid()
function uid() { return "p-" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

function dataPathFrom(opts) {
  const p = opts.data || process.env.CALCTL_DATA || DEFAULT_DATA;
  return path.resolve(p);
}

function loadData(dataPath) {
  let raw;
  try { raw = fs.readFileSync(dataPath, "utf8"); }
  catch (err) { throw new Error(`cannot read ${dataPath}: ${err.message}`); }
  let data;
  try { data = JSON.parse(raw); }
  catch (err) { throw new Error(`${dataPath}: invalid JSON (${err.message})`); }
  if (data.version !== 7) throw new Error(`${dataPath}: expected schema version 7, got ${data.version}`);
  data.posts = data.posts || [];
  data.inventory = data.inventory || [];
  data.comments = data.comments || {};
  data.markers = data.markers || {};
  return data;
}

// Every write bumps the top-level updatedAt.
function saveData(dataPath, data) {
  data.updatedAt = nowISO();
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n");
}
function appendActivity(action, item, detail = {}) {
  const entry = { ts: nowISO(), actor: process.env.USER || "calctl", action, id: item && item.id || "", title: item && item.title || "", detail };
  fs.mkdirSync(path.dirname(ACTIVITY), { recursive: true });
  fs.appendFileSync(ACTIVITY, JSON.stringify(entry) + "\n");
}

function themeKeys(data) { return Object.keys(data.config?.themes || {}); }

// Find by exact id in posts+inventory; fall back to unique case-insensitive
// title substring. Returns {item, kind} or throws with a helpful message.
function findItem(data, ref) {
  for (const p of data.posts) if (p.id === ref) return { item: p, kind: "post" };
  for (const it of data.inventory) if (it.id === ref) return { item: it, kind: "inventory" };
  const needle = ref.toLowerCase();
  const hits = [];
  for (const p of data.posts) if ((p.title || "").toLowerCase().includes(needle)) hits.push({ item: p, kind: "post" });
  for (const it of data.inventory) if ((it.title || "").toLowerCase().includes(needle)) hits.push({ item: it, kind: "inventory" });
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) throw new Error(`"${ref}" matches ${hits.length} items: ${hits.map(h => `${h.item.id} (${h.item.title})`).join(", ")} — use the id`);
  throw new Error(`no post or inventory item matches "${ref}"`);
}

module.exports = { ROOT, DEFAULT_DATA, ACTIVITY, nowISO, uid, dataPathFrom, loadData, saveData, appendActivity, themeKeys, findItem };
