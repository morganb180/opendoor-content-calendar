#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "data/calendar.json"), "utf8"));
const failures = [];
const warnings = [];

function canvaUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const id = raw.match(/\bDA[A-Za-z0-9_-]{6,}\b/)?.[0];
  return id ? `https://www.canva.com/design/${id}/view` : "";
}
async function check(url, owner) {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (res.ok || [401, 403, 405].includes(res.status)) return;
    failures.push(`${owner}: ${url} returned HTTP ${res.status}`);
  } catch (err) {
    warnings.push(`${owner}: ${url} check skipped (${err.message})`);
  }
}

(async () => {
  for (const item of [...data.posts, ...data.inventory]) {
    const owner = `${item.id} ${item.title}`;
    const canva = canvaUrl(item.canva);
    if (canva) await check(canva, owner);
    const video = item.media && item.media.video;
    if (/^https?:\/\//i.test(video || "")) await check(video, owner);
    if (item.postedUrl) await check(item.postedUrl, owner);
  }
  warnings.forEach(w => console.warn(`WARN ${w}`));
  if (failures.length) {
    console.error(failures.map(f => `ERROR ${f}`).join("\n"));
    if (process.env.GITHUB_OUTPUT) {
      const delimiter = `LINKCHECK_${Date.now()}`;
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `failures<<${delimiter}\n${failures.join("\n")}\n${delimiter}\n`
      );
    }
    process.exit(1);
  }
  console.log("Link check passed");
})();
