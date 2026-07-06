#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const dataPath = path.join(root, "data/calendar.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const budget = 300 * 1024;
const refs = [...data.posts, ...data.inventory]
  .flatMap(item => [item.media?.img, ...(item.media?.slides || [])])
  .filter(Boolean)
  .filter(ref => !/^(https?:|file:|data:|~\/|\/)/i.test(ref));
const uniqueRefs = [...new Set(refs)].filter(ref => /\.(png|jpe?g|webp|gif)$/i.test(ref));

function has(cmd) { return spawnSync("which", [cmd], { stdio: "ignore" }).status === 0; }
function size(file) { return fs.statSync(file).size; }
function runSips(file, max) { return spawnSync("sips", ["-Z", String(max), file], { stdio: "ignore" }).status === 0; }
function convertToJpeg(file) {
  const jpg = file.replace(/\.png$/i, ".jpg");
  const result = spawnSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "80", file, "--out", jpg], { stdio: "ignore" });
  return result.status === 0 && fs.existsSync(jpg) ? jpg : null;
}
function replaceRef(oldRef, newRef) {
  for (const item of [...data.posts, ...data.inventory]) {
    if (item.media?.img === oldRef) item.media.img = newRef;
    if (Array.isArray(item.media?.slides)) item.media.slides = item.media.slides.map(ref => ref === oldRef ? newRef : ref);
  }
}

const hasSips = has("sips");
if (!hasSips) {
  // No sips (e.g. GitHub CI on ubuntu): skip auto-shrink but still enforce the budget.
  console.log("sips not found — check-only mode: enforcing the 300 KB budget without auto-shrinking.");
  const over = uniqueRefs
    .map(ref => ({ ref, file: path.join(root, ref) }))
    .filter(({ file }) => fs.existsSync(file) && size(file) > budget)
    .map(({ ref, file }) => ({ ref, size: size(file) }));
  if (!over.length) console.log("All referenced preview images are within the 300 KB budget.");
  else {
    console.error(over.map(item => `Over budget: ${item.ref} ${Math.round(item.size / 1024)} KB (>300 KB — optimize on macOS or shrink manually)`).join("\n"));
    process.exit(1);
  }
  return;
}

const changed = [];
const over = [];
let dataChanged = false;
for (const ref of uniqueRefs) {
  const file = path.join(root, ref);
  if (!fs.existsSync(file) || size(file) <= budget) continue;
  const before = size(file);
  for (const max of [1600, 1400, 1200, 1000, 850, 720]) {
    runSips(file, max);
    if (size(file) <= budget) break;
  }
  let finalFile = file;
  let finalRef = ref;
  if (size(file) > budget && /\.png$/i.test(file)) {
    const jpg = convertToJpeg(file);
    if (jpg) {
      for (const max of [1000, 850, 720, 600, 480]) {
        runSips(jpg, max);
        if (size(jpg) <= budget) break;
      }
      if (size(jpg) < size(file)) {
        finalFile = jpg;
        finalRef = path.relative(root, jpg).split(path.sep).join("/");
        replaceRef(ref, finalRef);
        fs.unlinkSync(file);
        dataChanged = true;
      } else fs.unlinkSync(jpg);
    }
  }
  const after = size(finalFile);
  changed.push({ ref: finalRef, before, after });
  if (after > budget) over.push({ ref: finalRef, size: after });
}

if (dataChanged) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n");
}

changed.forEach(item => console.log(`${item.ref}: ${Math.round(item.before / 1024)} KB -> ${Math.round(item.after / 1024)} KB`));
if (!changed.length) console.log("All referenced preview images are within the 300 KB budget.");
if (over.length) {
  console.error(over.map(item => `Still over budget: ${item.ref} ${Math.round(item.size / 1024)} KB`).join("\n"));
  process.exit(1);
}
