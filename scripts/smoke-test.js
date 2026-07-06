const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const js = fs.readFileSync(path.join(root, "app.js"), "utf8");
const data = JSON.parse(fs.readFileSync(path.join(root, "data/calendar.json"), "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requireText(source, needle, label) {
  assert(source.includes(needle), `Missing ${label}: ${needle}`);
}

new vm.Script(js, { filename: "app.js" });

requireText(html, '<link rel="stylesheet" href="styles.css">', "stylesheet link");
requireText(html, '<script src="app.js"></script>', "app script tag");
requireText(html, 'id="f-socialCaption"', "social caption field");
requireText(html, 'id="f-status"', "status field");
requireText(html, 'id="dataAsOf"', "data as-of indicator");
requireText(html, 'id="lbComments"', "lightbox comments section");
assert(!/\son(?:click|change|input|submit|keydown|error)=/.test(html), "Inline DOM event handlers remain in index.html");
requireText(html, 'data-action="open-add"', "delegated add-post action");
requireText(html, 'data-action="copy-social-caption"', "copy caption action");
requireText(html, 'data-action="open-canva-import"', "Canva import action");
requireText(html, 'id="canvaImportText"', "Canva import textarea");
requireText(html, 'data-action="sample-canva-import"', "Canva import sample action");
requireText(html, 'data-action="clear-canva-import"', "Canva import clear action");

requireText(css, ".lb-comments", "comments styling");
requireText(css, "@media(max-width:760px)", "mobile breakpoint");
requireText(css, ".canva-push-row", "Canva push styling");
requireText(css, ".import-modal", "Canva import styling");
requireText(css, ".mini-del", "Canva import row removal styling");
requireText(css, ".status-chip", "status chip styling");
requireText(css, ".data-asof", "data as-of styling");
requireText(css, ".vbadge.local", "local-only video badge styling");

requireText(js, "const storage=", "centralized storage helper");
requireText(js, "function buildPayload()", "shared payload builder");
requireText(js, "function applyPayload(d", "shared payload importer");
requireText(js, "async function loadInitialData()", "data-first loader");
requireText(js, "function cleanupComments()", "comment cleanup helper");
requireText(js, "const LAST_SYNC_KEY", "sync conflict tracking");
requireText(js, "const TODAY=localDateKey(new Date())", "dynamic Today value");
requireText(js, "const UPLOAD_MAX_BYTES=300*1024", "preview upload cap");
requireText(js, "function safeURL", "URL scheme whitelist helper");
requireText(js, "function escAttr", "attribute escaping helper");
requireText(js, "function isLocalOnlyVideo", "local-only video helper");
requireText(js, "LOCAL ONLY", "local-only video label");
requireText(js, "function parseCanvaImports()", "Canva import parser");
requireText(js, "function extractCanvaId(value)", "Canva ID extractor");
requireText(js, "function updateCanvaImportField(el)", "Canva import editable fields");
requireText(js, "function removeCanvaImport(index)", "Canva import row removal");
requireText(js, "function saveCanvaImports()", "Canva import saver");
requireText(js, "function handleAction(e)", "delegated action handler");
requireText(js, "function handleInput(e)", "delegated input handler");
requireText(js, 'path:"data/calendar.json"', "GitHub sync data path");
assert(!/const DEFAULTS=\[\s*\{/.test(js), "Seed posts remain embedded in app.js");
assert(!/const INVENTORY=\[\s*\{/.test(js), "Seed inventory remains embedded in app.js");
assert(data.version === 7, "data/calendar.json must be version 7");
assert(Array.isArray(data.posts) && data.posts.length > 0, "data/calendar.json has no posts");
assert(Array.isArray(data.inventory) && data.inventory.length > 0, "data/calendar.json has no inventory");
assert(!js.includes("pushCaptionToCanva"), "Broken browser Canva Autofill push still exists");
assert(!js.includes("canva_connect_token"), "Canva API token storage still exists");
assert(!html.includes("f-canvaCaptionField"), "Canva caption field UI still exists");
assert(!html.includes("push-caption-canva"), "Canva push button still exists");
assert(!/src="'\+\([^)]*\.img\|href="'\+\(canvaURL\|fileURL\)|poster="'\+\([^)]*\.img/.test(js), "Unescaped media/link attribute interpolation remains");

const mediaRefs = [...data.posts, ...data.inventory].flatMap(item => [item.media?.img, ...(item.media?.slides || [])]);
const referencedAssets = mediaRefs.filter(asset => asset && !/^(https?:|file:|data:|~\/|\/)/i.test(asset)).map(asset => path.join(root, asset));
const missingAssets = referencedAssets.filter((asset) => !fs.existsSync(asset));
assert(missingAssets.length === 0, `Missing preview assets:\n${missingAssets.join("\n")}`);

console.log("Smoke test passed");
