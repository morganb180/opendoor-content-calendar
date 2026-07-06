// Canva id extraction + batch-import line parser + Canva Connect API client.
// Ports of extractCanvaId / splitImportRow / normalizeDate / normalizeTheme /
// parseCanvaImportLine from app.js — keep behavior in lockstep with the UI.
// The Connect section (OAuth 2.0 PKCE + designs API) powers `calctl canva pull`.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { spawn } = require("child_process");

function extractCanvaId(value) {
  const raw = (value || "").trim();
  if (!raw) return null;
  return raw.match(/[?&](?:design_id|template_id)=([^&#]+)/)?.[1] ||
    raw.match(/\/design\/([^/?#]+)/)?.[1] ||
    raw.match(/\/templates\/([^/?#]+)/)?.[1] ||
    raw.match(/\bDA[A-Za-z0-9_-]{6,}\b/)?.[0] || null;
}

function canvaLinksFrom(text) {
  return text.match(/https?:\/\/[^\s,"'<>]*canva\.com\/[^\s,"'<>]*/gi) || [];
}

function splitImportRow(row) {
  const delimiter = row.includes("\t") ? "\t" : row.includes("|") ? "|" : ",";
  const out = [];
  let cur = "", quoted = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i], next = row[i + 1];
    if (ch === '"' && quoted && next === '"') { cur += '"'; i++; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === delimiter && !quoted) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur.trim());
  return out.filter(Boolean);
}

function normalizeDate(value) {
  const s = (value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const y = Number(m[3].length === 2 ? "20" + m[3] : m[3]);
  return y + "-" + String(m[1]).padStart(2, "0") + "-" + String(m[2]).padStart(2, "0");
}

// Accepts the UI's alias map plus any theme key defined in the data file.
function normalizeTheme(value, themeKeys) {
  const key = (value || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!key) return null;
  const map = { seasonal: "seasonal", worldcup: "worldcup", world: "worldcup", wc: "worldcup", meme: "meme", proof: "proof", brand: "brand" };
  if (themeKeys && themeKeys.includes(key)) return key;
  const mapped = map[key] || null;
  if (mapped && (!themeKeys || themeKeys.includes(mapped))) return mapped;
  return null;
}

function inferCanvaTitle(canvaId) {
  return canvaId ? "Canva design " + canvaId : "Untitled Canva import";
}

// Parses one import line: a Canva URL/id alone, or delimited fields in any
// order (URL, date, theme, title, caption...). Returns null if no Canva id.
function parseCanvaImportLine(line, defaults, themeKeys) {
  const fields = splitImportRow(line);
  let canvaField = fields.find(x => extractCanvaId(x));
  if (!canvaField) {
    const links = canvaLinksFrom(line);
    canvaField = links[0] || line.match(/\bDA[A-Za-z0-9_-]{6,}\b/)?.[0];
  }
  const canvaId = extractCanvaId(canvaField);
  if (!canvaId) return null;
  const rest = fields.filter(x => x !== canvaField);
  const dateIndex = rest.findIndex(x => normalizeDate(x));
  const themeIndex = rest.findIndex(x => normalizeTheme(x, themeKeys));
  const targetDate = dateIndex >= 0 ? normalizeDate(rest[dateIndex]) : "";
  const theme = themeIndex >= 0 ? normalizeTheme(rest[themeIndex], themeKeys) : defaults.theme;
  const remainder = rest.filter((_, i) => i !== dateIndex && i !== themeIndex);
  const title = remainder[0] || inferCanvaTitle(canvaId);
  const socialCaption = remainder.slice(1).join(", ");
  const caption = "Imported from Canva" + (targetDate ? " · target date " + targetDate : "") + ".";
  return { title, theme, fmt: defaults.fmt, caption, socialCaption, canva: canvaId, targetDate };
}

// ===========================================================================
// Canva Connect API — OAuth 2.0 (PKCE) + designs read, for `calctl canva pull`.
// Runs locally: a temporary loopback http server catches the OAuth redirect;
// tokens are cached (0600) under ~/.config/opendoor-calendar/. Zero deps.
// ===========================================================================

const AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
const TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
const DESIGN_URL = "https://api.canva.com/rest/v1/designs/";
const SCOPES = ["design:meta:read"];
const CONFIG_DIR = path.join(os.homedir(), ".config", "opendoor-calendar");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const TOKENS_FILE = path.join(CONFIG_DIR, "tokens.json");

class CanvaApiError extends Error { constructor(status, message) { super(message); this.name = "CanvaApiError"; this.status = status; } }
class CanvaAuthError extends Error { constructor(message) { super(message); this.name = "CanvaAuthError"; } }

// --- PKCE ---------------------------------------------------------------
function base64url(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function createVerifier() { return base64url(crypto.randomBytes(32)); } // 43 chars, within RFC 7636's 43–128
function challengeFor(verifier) { return base64url(crypto.createHash("sha256").update(verifier).digest()); }

// --- config + token cache ----------------------------------------------
function readConnectConfig() {
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")); } catch { /* optional file */ }
  return {
    clientId: (process.env.CANVA_CLIENT_ID || cfg.clientId || cfg.client_id || "").trim(),
    clientSecret: (process.env.CANVA_CLIENT_SECRET || cfg.clientSecret || cfg.client_secret || "").trim(),
  };
}
function readTokens(file = TOKENS_FILE) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; } }
function writeTokens(tokens, file = TOKENS_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify(tokens, null, 2) + "\n", { mode: 0o600 });
  try { fs.chmodSync(file, 0o600); } catch { /* best effort on non-POSIX */ }
}
function clearTokens(file = TOKENS_FILE) { try { fs.unlinkSync(file); } catch { /* already gone */ } }
function withMeta(tokens) { return { ...tokens, obtained_at: Date.now() }; }

// --- authorize URL + token requests ------------------------------------
function buildAuthorizeUrl({ clientId, redirectUri, codeChallenge, state, scopes = SCOPES }) {
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("scope", scopes.join(" "));
  u.searchParams.set("code_challenge", codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("state", state);
  return u.toString();
}
// Canva Connect accepts confidential clients (Basic auth with the secret) and
// public PKCE clients (client_id in the body). We send whichever the config has.
async function tokenRequest(params, config, fetchImpl = fetch) {
  const body = new URLSearchParams(params);
  const headers = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };
  if (config.clientSecret) headers.Authorization = "Basic " + Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  else body.set("client_id", config.clientId);
  const res = await fetchImpl(TOKEN_URL, { method: "POST", headers, body });
  if (!res.ok) { let detail = ""; try { detail = (await res.text()).slice(0, 300); } catch { /* ignore */ } throw new CanvaAuthError(`token endpoint HTTP ${res.status}${detail ? ": " + detail : ""}`); }
  return withMeta(await res.json());
}
function exchangeCode(config, { code, codeVerifier, redirectUri }, fetchImpl = fetch) {
  return tokenRequest({ grant_type: "authorization_code", code, code_verifier: codeVerifier, redirect_uri: redirectUri }, config, fetchImpl);
}
function refreshTokens(config, refreshToken, fetchImpl = fetch) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken }, config, fetchImpl);
}

// --- interactive browser authorization (loopback redirect) -------------
function openBrowser(url) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try { spawn(cmd, args, { detached: true, stdio: "ignore" }).unref(); } catch { /* user can copy the URL */ }
}
async function authorizeInteractive(config, { log = () => {}, scopes = SCOPES, fetchImpl = fetch, timeoutMs = 5 * 60 * 1000 } = {}) {
  const verifier = createVerifier();
  const codeChallenge = challengeFor(verifier);
  const state = base64url(crypto.randomBytes(16));
  const server = http.createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = server.address().port;
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const authUrl = buildAuthorizeUrl({ clientId: config.clientId, redirectUri, codeChallenge, state, scopes });
  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { server.close(); reject(new CanvaAuthError("timed out waiting for Canva authorization (5 min)")); }, timeoutMs);
    server.on("request", (req, res) => {
      const u = new URL(req.url, redirectUri);
      if (u.pathname !== "/callback") { res.writeHead(404); res.end("not found"); return; }
      const err = u.searchParams.get("error"), got = u.searchParams.get("code"), st = u.searchParams.get("state");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!doctype html><meta charset=utf-8><body style="font-family:system-ui;padding:3rem"><h2>${err ? "Canva authorization failed." : "Authorized ✓"}</h2><p>You can close this tab and return to the terminal.</p></body>`);
      clearTimeout(timer); server.close();
      if (err) return reject(new CanvaAuthError("Canva authorization error: " + err));
      if (st !== state) return reject(new CanvaAuthError("state mismatch on OAuth redirect; aborting"));
      if (!got) return reject(new CanvaAuthError("no authorization code returned"));
      resolve(got);
    });
  });
  log(`Opening your browser to authorize Canva access (scopes: ${scopes.join(", ")}).\nIf it does not open, paste this into a browser:\n${authUrl}`);
  openBrowser(authUrl);
  return exchangeCode(config, { code, codeVerifier: verifier, redirectUri }, fetchImpl);
}

// --- designs API client (auto-refresh on expiry / 401) -----------------
function normalizeDesignResponse(body) {
  const d = (body && body.design) || body || {};
  const thumb = d.thumbnail || {};
  return { id: d.id || "", title: (d.title || "").trim(), thumbnailUrl: thumb.url || "" };
}
function isExpired(tokens, skewMs = 30 * 1000) {
  if (!tokens || !tokens.expires_in || !tokens.obtained_at) return false; // unknown → let a 401 drive the refresh
  return Date.now() + skewMs >= tokens.obtained_at + tokens.expires_in * 1000;
}
function createClient(config, tokens, { fetchImpl = fetch, onTokens = () => {} } = {}) {
  let current = tokens;
  async function doRefresh() {
    if (!current || !current.refresh_token) throw new CanvaAuthError("no refresh token cached; re-run to authorize");
    current = await refreshTokens(config, current.refresh_token, fetchImpl);
    if (!current.refresh_token && tokens.refresh_token) current.refresh_token = tokens.refresh_token; // Canva may omit it on refresh
    onTokens(current);
  }
  function request(designId) {
    return fetchImpl(DESIGN_URL + encodeURIComponent(designId), { headers: { Authorization: `Bearer ${current.access_token}`, Accept: "application/json" } });
  }
  return {
    get tokens() { return current; },
    async getDesign(designId) {
      if (isExpired(current)) await doRefresh();
      let res = await request(designId);
      if (res.status === 401) { await doRefresh(); res = await request(designId); }
      if (res.status === 401) throw new CanvaAuthError("still unauthorized after refresh; re-run to authorize");
      if (res.status === 403) throw new CanvaApiError(403, "403 forbidden (missing scope or plan tier does not permit the designs API)");
      if (res.status === 404) throw new CanvaApiError(404, "404 not found (no such design, or not owned by the authorized account)");
      if (!res.ok) { let detail = ""; try { detail = (await res.text()).slice(0, 200); } catch { /* ignore */ } throw new CanvaApiError(res.status, `HTTP ${res.status}${detail ? ": " + detail : ""}`); }
      return normalizeDesignResponse(await res.json());
    },
  };
}

// --- pull logic (pure): decide what a fetched design changes on a record -
function isPlaceholderTitle(title) {
  const s = String(title || "").trim();
  return !s || /^Canva design /.test(s) || s === "Untitled Canva import";
}
// Returns { title: <new title|null>, needsImg: <bool> } — never mutates.
function planDesignUpdate(record, design, { force = false } = {}) {
  const plan = { title: null, needsImg: false };
  if (design.title && (force || isPlaceholderTitle(record.title)) && record.title !== design.title) plan.title = design.title;
  const hasImg = !!(record.media && record.media.img);
  if (design.thumbnailUrl && (force || !hasImg)) plan.needsImg = true;
  return plan;
}

// --- thumbnail download -------------------------------------------------
async function downloadTo(url, dest, fetchImpl = fetch) {
  const res = await fetchImpl(url, { redirect: "follow" });
  if (!res.ok) throw new CanvaApiError(res.status, `thumbnail download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return buf.length;
}

module.exports = {
  extractCanvaId, canvaLinksFrom, splitImportRow, normalizeDate, normalizeTheme, parseCanvaImportLine,
  // Connect API
  SCOPES, CONFIG_DIR, CONFIG_FILE, TOKENS_FILE, CanvaApiError, CanvaAuthError,
  base64url, createVerifier, challengeFor, buildAuthorizeUrl,
  readConnectConfig, readTokens, writeTokens, clearTokens,
  exchangeCode, refreshTokens, authorizeInteractive, createClient, normalizeDesignResponse,
  isPlaceholderTitle, planDesignUpdate, downloadTo,
};
