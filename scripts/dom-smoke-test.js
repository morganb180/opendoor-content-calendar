#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "app.js"), "utf8");
const data = JSON.parse(fs.readFileSync(path.join(root, "data/calendar.json"), "utf8"));
const GATE_HASH = "dc7d2350f3beddb9fc85ad1c8a12b958a6fcd7128fe27765710136018e87db49";

function assert(condition, message) { if (!condition) throw new Error(message); }

class ClassList {
  constructor(el) { this.el = el; this.set = new Set(); }
  add(...names) { names.forEach(name => this.set.add(name)); this.sync(); }
  remove(...names) { names.forEach(name => this.set.delete(name)); this.sync(); }
  toggle(name, force) { const on = force === undefined ? !this.set.has(name) : !!force; on ? this.set.add(name) : this.set.delete(name); this.sync(); return on; }
  contains(name) { return this.set.has(name); }
  sync() { this.el.className = [...this.set].join(" "); }
}

class Element {
  constructor(tagName, id = "") {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.className = "";
    this.classList = new ClassList(this);
    this.value = "";
    this.textContent = "";
    this._html = "";
    this.listeners = {};
  }
  set innerHTML(value) { this._html = String(value); this.textContent = String(value).replace(/<[^>]+>/g, ""); }
  get innerHTML() { return this._html; }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener(type, handler) { (this.listeners[type] = this.listeners[type] || []).push(handler); }
  closest() { return null; }
  focus() {}
  select() {}
  click() {}
  insertAdjacentHTML(_where, html) { this.innerHTML = html + this.innerHTML; }
}

class Document {
  constructor(htmlSource) {
    this.elements = new Map();
    this.listeners = {};
    [...htmlSource.matchAll(/<([a-zA-Z0-9]+)[^>]*\sid="([^"]+)"[^>]*>/g)].forEach(([, tag, id]) => this.add(new Element(tag, id)));
  }
  add(el) { this.elements.set(el.id, el); return el; }
  getElementById(id) { return this.elements.get(id) || this.add(new Element("div", id)); }
  createElement(tag) { return new Element(tag); }
  addEventListener(type, handler) { (this.listeners[type] = this.listeners[type] || []).push(handler); }
  querySelectorAll(selector) {
    if (selector === ".chip[draggable]") return (this.getElementById("grid").innerHTML.match(/class="chip/g) || []).map(() => new Element("div"));
    if (selector === ".cell[data-date]") return (this.getElementById("grid").innerHTML.match(/data-date="/g) || []).map(() => new Element("div"));
    return [];
  }
}

const localStorageData = new Map();   // start locked — the test exercises the real gate unlock
let capturedBlobText = null;           // last Blob handed to URL.createObjectURL (export capture)
const document = new Document(html);
const context = {
  console,
  document,
  window: {},
  location: { reload() { throw new Error("unexpected reload"); } },
  localStorage: {
    getItem(key) { return localStorageData.has(key) ? localStorageData.get(key) : null; },
    setItem(key, value) { localStorageData.set(key, String(value)); },
    removeItem(key) { localStorageData.delete(key); }
  },
  navigator: { clipboard: { writeText: async () => {} } },
  crypto: { subtle: null },
  TextEncoder,
  Blob: class Blob { constructor(parts, opts) { this.parts = parts; this.type = opts && opts.type; } },
  URL: { createObjectURL(b) { capturedBlobText = (b.parts || []).join(""); return "blob:dom-smoke"; } },
  FileReader: class { readAsText(file) { this.result = file._text; if (this.onload) this.onload(); } readAsDataURL(file) { this.result = file._text || ""; if (this.onload) this.onload(); } },
  Date,
  setTimeout(fn) { fn(); return 1; },
  clearTimeout() {},
  prompt() { return "DOM Smoke"; },
  confirm() { return true; },
  alert(message) { throw new Error(`alert: ${message}`); },
  fetch: async (url) => {
    if (String(url).startsWith("data/calendar.json")) return { ok: true, json: async () => JSON.parse(JSON.stringify(data)) };
    if (String(url).startsWith("data/activity.jsonl")) return { ok: true, text: async () => '{"ts":"2026-07-02T00:00:00.000Z","actor":"system","action":"migrate","id":"data/calendar.json","title":"Migrated calendar content"}\n' };
    return { ok: false, json: async () => ({}) };
  }
};
context.window = context;

async function settle(predicate) {
  for (let i = 0; i < 20 && !predicate(); i++) await new Promise(resolve => setImmediate(resolve));
}

(async () => {
  vm.runInNewContext(js, context, { filename: "app.js" });

  // §8 (a): real gate unlock — no pre-set cal_gate_ok; submit the actual password and verify SHA-256 gate.
  assert(document.getElementById("gate").style.display === "grid", "gate should be shown before unlock");
  assert(String(document.getElementById("s-posts").textContent) === "", "app rendered before the gate was unlocked");
  document.getElementById("gatePass").value = "opendoor2026";
  await context.submitGate({ preventDefault() {} });
  assert(localStorageData.get("cal_gate_ok") === GATE_HASH, "gate did not unlock with the correct password");
  assert(document.getElementById("gate").style.display === "none", "gate overlay not hidden after unlock");
  await settle(() => String(document.getElementById("s-posts").textContent) === String(data.posts.length));

  assert(String(document.getElementById("s-posts").textContent) === String(data.posts.length), "post count did not render: got " + document.getElementById("s-posts").textContent + ", toast=" + document.getElementById("toast").textContent);
  assert((document.getElementById("grid").innerHTML.match(/class="chip/g) || []).length >= 1, "grid rendered no chips");
  assert(document.getElementById("listView").innerHTML.includes(data.posts[0].title), "list did not render first post");
  assert(document.getElementById("invCards").innerHTML.includes(data.inventory[0].title), "inventory did not render first item");
  assert(document.getElementById("dataAsOf").textContent.includes("data as of"), "data as-of indicator missing");
  assert(document.getElementById("activityList").innerHTML.includes("Migrated calendar content"), "activity list did not render");

  // §8 (c): lightbox actually renders a media element with the expected src.
  context.openPreview(data.posts[0].id);
  const media = document.getElementById("lbMedia").innerHTML;
  const expectedSrc = (data.posts[0].media.slides && data.posts[0].media.slides[0]) || data.posts[0].media.img;
  assert(/<(img|video)[^>]*\ssrc="[^"]+"/.test(media), "lightbox media element did not render with a src");
  assert(media.includes(expectedSrc), "lightbox media src does not match expected asset " + expectedSrc);

  document.getElementById("lbCommentInput").value = "Looks good";
  context.addComment();
  const comments = JSON.parse(localStorageData.get("opendoor_comments_v1"));
  assert(comments[data.posts[0].id] && comments[data.posts[0].id].length === 1, "comment was not saved");

  // §8 (b): export -> import round-trip preserves posts/inventory/comments.
  capturedBlobText = null;
  context.exportJSON();
  assert(capturedBlobText, "exportJSON did not produce a Blob");
  const exported = JSON.parse(capturedBlobText);
  assert(exported.version === 7 && Array.isArray(exported.posts), "exported payload is malformed");
  const before = { posts: JSON.stringify(exported.posts), inventory: JSON.stringify(exported.inventory), comments: JSON.stringify(exported.comments) };
  context.importJSON({ target: { files: [{ _text: capturedBlobText }], value: "x" } });
  const round = context.buildPayload();
  assert(JSON.stringify(round.posts) === before.posts, "posts changed across export/import round-trip");
  assert(JSON.stringify(round.inventory) === before.inventory, "inventory changed across export/import round-trip");
  assert(JSON.stringify(round.comments) === before.comments, "comments changed across export/import round-trip");

  // Regression for finding #3: a v6 localStorage user's custom inventory + comments must survive first load.
  // The second post is a stale copy of a REMOTE seed with NO updatedAt (the true v6 shape):
  // the remote version must win the merge, or dead preview paths resurrect (epoch-stamp bug).
  localStorageData.set("opendoor_calendar_v2", JSON.stringify([
    { id: "v6-post", title: "V6 Local Post", date: "2026-07-20", theme: "brand", status: "scheduled", fmt: "Static · 3:4", caption: "", img: "previews/busy-month.png", updatedAt: "2026-07-01T00:00:00.000Z" },
    { id: data.posts[0].id, title: "Stale Seed Copy", date: data.posts[0].date, theme: "meme", fmt: "Static · 3:4", caption: "", img: "previews/deleted-legacy.png" }
  ]));
  localStorageData.set("opendoor_inv_custom_v1", JSON.stringify([{ id: "v6-inv", title: "V6 Custom Inventory", theme: "brand", status: "ready", fmt: "Static · 4:5", caption: "", img: "previews/busy-month.png", updatedAt: "2026-07-01T00:00:00.000Z" }]));
  localStorageData.set("opendoor_comments_v1", JSON.stringify({ "v6-inv": [{ id: "c-v6", author: "Legacy", text: "legacy note on a custom item", ts: 1730000000000 }] }));
  await context.loadInitialData();
  const invAfter = JSON.parse(localStorageData.get("opendoor_inv_custom_v1"));
  const postsAfter = JSON.parse(localStorageData.get("opendoor_calendar_v2"));
  const commentsAfter = JSON.parse(localStorageData.get("opendoor_comments_v1"));
  assert(invAfter.some(it => it.id === "v6-inv"), "v6 custom inventory item was destroyed on load");
  assert(invAfter.some(it => it.id === data.inventory[0].id), "remote inventory was lost merging local custom inventory");
  assert(postsAfter.some(p => p.id === "v6-post"), "v6 local post was lost on load");
  assert(postsAfter.some(p => p.id === data.posts[0].id), "remote posts were lost on load");
  const seedAfter = postsAfter.find(p => p.id === data.posts[0].id);
  assert(seedAfter.title !== "Stale Seed Copy" && seedAfter.img === (data.posts[0].media && data.posts[0].media.img || data.posts[0].img),
    "stale unstamped v6 seed copy beat the remote record in the merge");
  assert(commentsAfter["v6-inv"] && commentsAfter["v6-inv"].length === 1, "v6 comment on a custom item was lost on load");

  console.log("DOM smoke test passed");
})().catch(err => { console.error(err.stack || err.message); process.exit(1); });
