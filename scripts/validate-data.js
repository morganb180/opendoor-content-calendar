#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "data/calendar.json");
const schemaPath = path.join(root, "data/calendar.schema.json");
const errors = [];
const warnings = [];

/* ===== minimal zero-dependency JSON-Schema subset walker =====
   handles: $ref/$defs, allOf, oneOf, const, enum, type, minLength, pattern,
   format(date-time), required, properties, additionalProperties, items. */
function schemaType(v) { return Array.isArray(v) ? "array" : v === null ? "null" : typeof v; }
function resolveRef(ref, rootSchema) { return ref.replace(/^#\//, "").split("/").reduce((o, k) => o && o[k], rootSchema); }
function checkSchema(value, schema, rootSchema, at, errs) {
  if (!schema || typeof schema !== "object") return;
  if (schema.$ref) { checkSchema(value, resolveRef(schema.$ref, rootSchema), rootSchema, at, errs); return; }
  if (Array.isArray(schema.allOf)) schema.allOf.forEach(s => checkSchema(value, s, rootSchema, at, errs));
  if (Array.isArray(schema.oneOf)) {
    const matched = schema.oneOf.filter(s => { const e = []; checkSchema(value, s, rootSchema, at, e); return !e.length; }).length;
    if (matched !== 1) errs.push(`${at || "<root>"}: must match exactly one schema (matched ${matched})`);
  }
  if ("const" in schema && value !== schema.const) errs.push(`${at || "<root>"}: must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${at || "<root>"}: must be one of ${schema.enum.join(", ")}`);
  if (schema.type && schemaType(value) !== schema.type) { errs.push(`${at || "<root>"}: expected ${schema.type}, got ${schemaType(value)}`); return; }
  if (typeof value === "string") {
    if (schema.minLength != null && value.length < schema.minLength) errs.push(`${at}: shorter than minLength ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errs.push(`${at}: does not match ${schema.pattern}`);
    if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) errs.push(`${at}: not a valid date-time`);
  }
  if (schemaType(value) === "object" && (schema.type === "object" || schema.properties || schema.required || "additionalProperties" in schema)) {
    (schema.required || []).forEach(k => { if (!(k in value)) errs.push(`${at ? at + "." : ""}${k}: required`); });
    const props = schema.properties || {};
    Object.keys(value).forEach(k => {
      const child = `${at ? at + "." : ""}${k}`;
      if (k in props) checkSchema(value[k], props[k], rootSchema, child, errs);
      else if (schema.additionalProperties === false) errs.push(`${child}: unexpected property`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === "object") checkSchema(value[k], schema.additionalProperties, rootSchema, child, errs);
    });
  }
  if (schemaType(value) === "array" && schema.items) value.forEach((v, i) => checkSchema(v, schema.items, rootSchema, `${at}[${i}]`, errs));
}

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (err) { errors.push(`${path.relative(root, file)}: ${err.message}`); return null; }
}
function isObject(value) { return value && typeof value === "object" && !Array.isArray(value); }
function isoDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || "") && !Number.isNaN(new Date(`${value}T00:00:00`).getTime()); }
function isoDateTime(value) { return typeof value === "string" && !Number.isNaN(Date.parse(value)); }
function canvaId(value) { return String(value || "").match(/\bDA[A-Za-z0-9_-]{6,}\b/)?.[0] || ""; }
function assetExists(ref, owner) {
  if (!ref || /^(https?:|file:|data:|~\/|\/)/i.test(ref)) return;
  const file = path.join(root, ref);
  if (!fs.existsSync(file)) errors.push(`${owner}: missing asset ${ref}`);
  else {
    const size = fs.statSync(file).size;
    if (/\.(png|jpe?g|webp|gif)$/i.test(ref) && size > 300 * 1024) warnings.push(`${owner}: ${ref} is ${Math.round(size / 1024)} KB (>300 KB target)`);
  }
}
function validateVideo(item, label) {
  const video = item.media && item.media.video;
  if (!video) return;
  if (/^~\//.test(video) && item.localOnly !== true) errors.push(`${label}: local ~/ video must set localOnly: true`);
  if (item.localOnly === true && !/^~\//.test(video)) warnings.push(`${label}: localOnly true but video is not a ~/ path`);
  if (!/^https?:\/\//i.test(video) && !/^~\//.test(video) && !/^file:\/\//i.test(video)) errors.push(`${label}: video must be https URL or explicitly local ~/ path`);
}
function validateItem(item, kind, themes, ids) {
  const label = `${kind} ${item && item.id ? item.id : "<missing id>"}`;
  if (!isObject(item)) { errors.push(`${kind}: expected object`); return; }
  ["id", "title", "theme", "fmt", "caption", "updatedAt"].forEach(key => {
    if (typeof item[key] !== "string") errors.push(`${label}: ${key} must be a string`);
  });
  if (ids.has(item.id)) errors.push(`${label}: duplicate id`);
  ids.add(item.id);
  if (!themes.has(item.theme)) errors.push(`${label}: unknown theme ${item.theme}`);
  if (!["draft", "ready", "scheduled", "posted"].includes(item.status)) errors.push(`${label}: invalid status ${item.status}`);
  if (!isoDateTime(item.updatedAt)) errors.push(`${label}: updatedAt must be ISO date-time`);
  if (kind === "post" && !isoDate(item.date)) errors.push(`${label}: date must be YYYY-MM-DD`);
  if (!isObject(item.media)) errors.push(`${label}: media must be an object`);
  else {
    assetExists(item.media.img, label);
    (item.media.slides || []).forEach(ref => assetExists(ref, label));
    validateVideo(item, label);
  }
}

const data = readJSON(dataPath);
const schema = readJSON(schemaPath);
if (data && schema) {
  const schemaErrors = [];
  checkSchema(data, schema, schema, "", schemaErrors);
  schemaErrors.forEach(e => errors.push(`schema: ${e}`));
}
if (data) {
  if (data.version !== 7) errors.push("version must be 7");
  if (!isoDateTime(data.updatedAt)) errors.push("updatedAt must be ISO date-time");
  if (!isObject(data.config)) errors.push("config must be an object");
  const themes = new Set(Object.keys(data.config?.themes || {}));
  if (!themes.size) errors.push("config.themes must not be empty");
  Object.entries(data.config?.themes || {}).forEach(([key, theme]) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(theme.color || "")) errors.push(`theme ${key}: color must be #RRGGBB`);
    if (!theme.label) errors.push(`theme ${key}: label is required`);
  });
  Object.entries(data.markers || {}).forEach(([date, value]) => {
    if (!isoDate(date)) errors.push(`marker ${date}: invalid date`);
    const list = Array.isArray(value) ? value : [value];
    list.forEach(marker => {
      if (!marker.label || !["hol", "evt", "mkt"].includes(marker.type)) errors.push(`marker ${date}: invalid marker`);
    });
  });
  const ids = new Set();
  (data.posts || []).forEach(item => validateItem(item, "post", themes, ids));
  (data.inventory || []).forEach(item => validateItem(item, "inventory", themes, ids));
  const canva = new Map();
  [...(data.posts || []), ...(data.inventory || [])].forEach(item => {
    const id = canvaId(item.canva);
    if (!id) return;
    if (canva.has(id)) warnings.push(`Canva id ${id} appears on both ${canva.get(id)} and ${item.id}`);
    else canva.set(id, item.id);
  });
  Object.entries(data.comments || {}).forEach(([itemId, list]) => {
    if (!ids.has(itemId)) warnings.push(`comments for unknown item ${itemId}`);
    if (!Array.isArray(list)) errors.push(`comments ${itemId}: must be an array`);
    (Array.isArray(list) ? list : []).forEach(comment => {
      if (!comment.id || !comment.author || !comment.text || typeof comment.ts !== "number") errors.push(`comments ${itemId}: invalid comment`);
    });
  });
}

if (warnings.length) console.warn(warnings.map(w => `WARN ${w}`).join("\n"));
if (errors.length) {
  console.error(errors.map(e => `ERROR ${e}`).join("\n"));
  process.exit(1);
}
console.log(`Data validation passed: ${path.relative(root, dataPath)}`);
