// Preview/media file handling for calctl add: copy images into previews/,
// downscale oversized copies via sips (macOS) when available, warn on the
// 300 KB budget (same target as scripts/validate-data.js), grab a video
// poster frame via ffmpeg when available.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
const { ROOT } = require("./store");

function expandTilde(p) { return p && p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p; }

const IMG_BUDGET = 300 * 1024;
const IMG_RE = /\.(png|jpe?g|webp|gif)$/i;

function has(cmd) {
  const r = spawnSync("which", [cmd], { stdio: "ignore" });
  return r.status === 0;
}

function isURL(v) { return /^https?:\/\//i.test(v || ""); }

function repoRelative(abs) {
  const rel = path.relative(ROOT, abs);
  return (!rel.startsWith("..") && !path.isAbsolute(rel)) ? rel : null;
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "asset";
}

// Downscale a copied (never a source) image in place if it exceeds the
// budget; sips is macOS-only, so just warn elsewhere. Returns final size.
function optimizeCopy(file, warn) {
  let size = fs.statSync(file).size;
  if (size <= IMG_BUDGET || !IMG_RE.test(file)) return size;
  if (has("sips")) {
    try {
      execFileSync("sips", ["-Z", "1600", file], { stdio: "ignore" });
      size = fs.statSync(file).size;
    } catch { /* keep original copy */ }
  }
  if (size > IMG_BUDGET) warn(`${path.relative(ROOT, file)} is ${Math.round(size / 1024)} KB (>300 KB target)`);
  return size;
}

// Resolve an --img value: repo-relative refs and in-repo paths pass through;
// outside paths are copied into previews/ (optimized). Returns the ref to store.
function resolveImage(value, { warn, subdir = "previews" }) {
  if (isURL(value)) return value;
  value = expandTilde(value);
  const abs = path.resolve(value);
  const inRepo = repoRelative(abs);
  if (inRepo && fs.existsSync(abs)) {
    if (fs.statSync(abs).size > IMG_BUDGET && IMG_RE.test(abs)) warn(`${inRepo} is ${Math.round(fs.statSync(abs).size / 1024)} KB (>300 KB target)`);
    return inRepo.split(path.sep).join("/");
  }
  // Maybe it's already a repo-relative ref like "previews/foo.png"
  const asRel = path.join(ROOT, value);
  if (!path.isAbsolute(value) && fs.existsSync(asRel)) {
    if (fs.statSync(asRel).size > IMG_BUDGET && IMG_RE.test(value)) warn(`${value} is ${Math.round(fs.statSync(asRel).size / 1024)} KB (>300 KB target)`);
    return value.split(path.sep).join("/");
  }
  if (!fs.existsSync(abs)) throw new Error(`image not found: ${value}`);
  const destDir = path.join(ROOT, subdir);
  fs.mkdirSync(destDir, { recursive: true });
  let dest = path.join(destDir, path.basename(abs));
  if (fs.existsSync(dest) && fs.statSync(dest).size !== fs.statSync(abs).size) {
    const ext = path.extname(abs);
    dest = path.join(destDir, path.basename(abs, ext) + "-" + Date.now().toString(36) + ext);
  }
  fs.copyFileSync(abs, dest);
  optimizeCopy(dest, warn);
  return path.relative(ROOT, dest).split(path.sep).join("/");
}

// Expand a --slides dir-or-glob into an ordered file list.
function expandSlides(value) {
  value = expandTilde(value);
  const abs = path.resolve(value);
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    return fs.readdirSync(abs).filter(f => IMG_RE.test(f)).sort()
      .map(f => path.join(abs, f));
  }
  // Simple glob: only * wildcards within the basename (and stray dir globs).
  if (value.includes("*")) {
    const dir = path.dirname(abs);
    if (!fs.existsSync(dir)) throw new Error(`slides directory not found: ${dir}`);
    const re = new RegExp("^" + path.basename(abs).split("*").map(s => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
    return fs.readdirSync(dir).filter(f => re.test(f)).sort().map(f => path.join(dir, f));
  }
  if (fs.existsSync(abs)) return [abs];
  throw new Error(`slides path not found: ${value}`);
}

// Copy slides into previews/slides/<id>/ unless they already live in the repo.
function resolveSlides(value, id, { warn }) {
  const files = expandSlides(value);
  if (!files.length) throw new Error(`no slide images matched: ${value}`);
  const refs = [];
  let destDir = null;
  for (const abs of files) {
    const inRepo = repoRelative(abs);
    if (inRepo) { refs.push(inRepo.split(path.sep).join("/")); continue; }
    if (!destDir) { destDir = path.join(ROOT, "previews", "slides", id); fs.mkdirSync(destDir, { recursive: true }); }
    const dest = path.join(destDir, path.basename(abs));
    fs.copyFileSync(abs, dest);
    optimizeCopy(dest, warn);
    refs.push(path.relative(ROOT, dest).split(path.sep).join("/"));
  }
  return refs;
}

// Poster frame from a local video, if ffmpeg is around. Returns ref or null.
function posterFromVideo(videoPath, id, { warn }) {
  if (!has("ffmpeg")) { warn("ffmpeg not found — no poster frame extracted; pass --img"); return null; }
  const destDir = path.join(ROOT, "previews");
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, slugify(id) + "-poster.jpg");
  const r = spawnSync("ffmpeg", ["-y", "-ss", "1", "-i", videoPath, "-frames:v", "1", "-vf", "scale='min(1080,iw)':-2", dest], { stdio: "ignore" });
  if (r.status !== 0 || !fs.existsSync(dest)) { warn("ffmpeg failed to extract a poster frame; pass --img"); return null; }
  optimizeCopy(dest, warn);
  return path.relative(ROOT, dest).split(path.sep).join("/");
}

module.exports = { IMG_BUDGET, isURL, expandTilde, resolveImage, resolveSlides, posterFromVideo, slugify, optimizeCopy };
