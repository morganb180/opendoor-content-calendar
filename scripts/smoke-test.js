const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const js = fs.readFileSync(path.join(root, "app.js"), "utf8");

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
requireText(html, 'id="f-canvaCaptionField"', "Canva caption field setting");
requireText(html, 'id="lbComments"', "lightbox comments section");
assert(!/\son(?:click|change|input|submit|keydown|error)=/.test(html), "Inline DOM event handlers remain in index.html");
requireText(html, 'data-action="open-add"', "delegated add-post action");
requireText(html, 'data-action="push-caption-canva"', "delegated Canva action");
requireText(html, 'data-action="open-canva-import"', "Canva import action");
requireText(html, 'id="canvaImportText"', "Canva import textarea");
requireText(html, 'data-action="sample-canva-import"', "Canva import sample action");
requireText(html, 'data-action="clear-canva-import"', "Canva import clear action");

requireText(css, ".lb-comments", "comments styling");
requireText(css, "@media(max-width:760px)", "mobile breakpoint");
requireText(css, ".canva-push-row", "Canva push styling");
requireText(css, ".import-modal", "Canva import styling");
requireText(css, ".mini-del", "Canva import row removal styling");

requireText(js, "const storage=", "centralized storage helper");
requireText(js, "function buildPayload()", "shared payload builder");
requireText(js, "function applyPayload(d)", "shared payload importer");
requireText(js, "function cleanupComments()", "comment cleanup helper");
requireText(js, "const LAST_SYNC_KEY", "sync conflict tracking");
requireText(js, "const CANVA_CAPTION_FIELD_KEY", "Canva field config");
requireText(js, "brand_template_id", "Canva Autofill payload");
requireText(js, "function parseCanvaImports()", "Canva import parser");
requireText(js, "function extractCanvaId(value)", "Canva ID extractor");
requireText(js, "function updateCanvaImportField(el)", "Canva import editable fields");
requireText(js, "function removeCanvaImport(index)", "Canva import row removal");
requireText(js, "function saveCanvaImports()", "Canva import saver");
requireText(js, "function handleAction(e)", "delegated action handler");
requireText(js, "function handleInput(e)", "delegated input handler");

const referencedAssets = [...js.matchAll(/(P|S)\+"([^"]+)"/g)].map(([, prefix, asset]) =>
  path.join(root, prefix === "S" ? "previews/slides" : "previews", asset)
);
const missingAssets = referencedAssets.filter((asset) => !fs.existsSync(asset));
assert(missingAssets.length === 0, `Missing preview assets:\n${missingAssets.join("\n")}`);

console.log("Smoke test passed");
