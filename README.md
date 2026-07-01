# Opendoor — Social Content Calendar

A self-contained, single-file content calendar (`index.html`) for scheduling Opendoor social
assets. Month grid + schedule list + unscheduled inventory, drag-and-drop, full-asset preview
lightbox, holiday/event markers, and cross-machine sync via a committed `calendar-data.json`.

Hosted on **GitHub Pages**: https://morganb180.github.io/opendoor-content-calendar/

## Password gate

There's a lightweight password screen on load. **This is deterrence, not security** — the page is
a public GitHub Pages site, so the source (and `calendar-data.json`) are publicly fetchable. Use it
to keep casual eyes out, not for anything confidential.

- **Default password:** `opendoor2026`
- **To change it:** generate a new SHA-256 hash and paste it into `GATE_HASH` in `index.html`:
  ```sh
  printf %s 'your-new-password' | shasum -a 256
  ```
  Commit + push. Everyone re-enters the new password on next load.

## Sync across machines

State lives in each browser's `localStorage`, and syncs through a `calendar-data.json` file in this repo.

- **Sync ↑ (push):** writes your current schedule + inventory to `calendar-data.json` via the GitHub
  API. The first push asks for a **fine-grained Personal Access Token** with **Contents: Read & Write**
  on this repo. The token is stored **only in that browser's localStorage** — it is never written into
  the page or the repo.
- **Sync ↓ (pull):** fetches the latest `calendar-data.json` and replaces local state.
- A fresh machine **auto-pulls** the shared state the first time it opens (once a push exists).
- **Export / Import** JSON also work for manual backup/sharing.

Create a token at https://github.com/settings/tokens?type=beta (Resource owner: morganb180,
Repository access: only `opendoor-content-calendar`, Permissions → Contents: Read and write).

## Previews & videos

- Image previews and swipeable carousel slides live in `previews/` and work on the hosted site.
- **Video spots** (Fireworks, World Cup, Red-Card, and the inventory videos) link to local files
  under `~/opendoor/` — they **won't play on the hosted site**. To make them play remotely, upload
  the mp4s somewhere (Drive/Canva/this repo) and update the `video:`/`file:` paths in `index.html`.

## Social captions & Canva push

Each post has two text fields:

- **Caption / notes** — internal notes about the post (existing field).
- **Social caption** — the actual caption text that goes live with the post on IG/FB.

When a post has both a **social caption** and a linked **Canva design**, the edit form shows a
**Push to Canva** button. This calls the [Canva Connect API](https://www.canva.com/developers/)
autofill endpoint to inject the caption text into the design. The first push asks for a Canva
Connect API token (stored only in the browser's localStorage, like the GitHub PAT).

If the API call fails (no token, wrong permissions, or network issues), **Copy caption** is a
fallback — it copies the text to your clipboard so you can paste it into Canva manually.

## Internal comments

Each post and inventory item has a **comments thread** in the lightbox preview panel. Comments
are stored in localStorage and synced via the same `calendar-data.json` mechanism (Sync ↑/↓).
The first comment asks for your name (stored in localStorage for future comments).

Comments show a 💬 count on the month-grid chip and are visible in the lightbox.

## Mobile support

The calendar is fully responsive:

- Month grid collapses to compact cells on phones (thumbnails only, no titles)
- Edit modal becomes full-screen
- Lightbox stacks vertically (media on top, info/comments below)
- Inventory cards switch to single-column
- Touch-friendly button sizes and spacing

## Editing the schedule in code

The seeded schedule is the `DEFAULTS` array near the top of the `<script>` in `index.html`; the
built-in inventory is `INVENTORY`; holidays/events are the `MARKERS` map. Most day-to-day changes
are easier through the UI (drag, + Add post, + Add inventory item), which persist locally and sync.
