# Opendoor — Social Content Calendar

A self-contained static content calendar for scheduling Opendoor social assets. Month grid with an
**Unscheduled rail** alongside it — drag a card onto a day to schedule (or tap-to-place on touch),
drag a chip back onto the rail to unschedule — plus a schedule list, a full inventory management tab,
a full-asset preview lightbox, holiday/event markers, and cross-machine sync via committed
`data/calendar.json`.

The app has no build step:

- `index.html` — markup
- `styles.css` — all styles and responsive rules
- `app.js` — data loading, rendering, persistence, sync, comments, and Canva import

Hosted on **GitHub Pages**: https://morganb180.github.io/opendoor-content-calendar/

CLI writes append a lightweight audit trail to `data/activity.jsonl`; CI validates data, smoke-rendering, image budget, and weekly external links.

## Password gate

There's a lightweight password screen on load. **This is deterrence, not security** — the page is
a public GitHub Pages site, so the source (and `data/calendar.json`) are publicly fetchable. Use it
to keep casual eyes out, not for anything confidential.

- **Default password:** `opendoor2026`
- **To change it:** generate a new SHA-256 hash and paste it into `GATE_HASH` in `app.js`:
  ```sh
  printf %s 'your-new-password' | shasum -a 256
  ```
  Commit + push. Everyone re-enters the new password on next load.

## Scheduling from the rail

The month grid has an **Unscheduled rail** on the right listing every ready inventory item (compact
card: thumbnail, theme accent, title, format, ▶ VIDEO / LOCAL ONLY badges, a "new" dot for items you
haven't seen, and any comment count). Three ways to schedule:

- **Drag** a rail card onto a day cell. Drag over the ‹ / › arrows to flip months mid-drag.
- **Tap-to-place** — click **Schedule →** on a card (or **Add to schedule →** in the lightbox /
  inventory tab), then click the target day. A banner shows the pending item; **Esc** or **Cancel**
  aborts. This is the primary path on touch, where HTML5 drag-and-drop isn't available.
- Dragging a scheduled **chip back onto the rail** unschedules it (returns it to inventory).

Scheduling **moves** the item out of inventory into the calendar keeping the same id (so its comments
follow it) — matching `tools/calctl schedule` semantics. The rail header collapses to a thin tab
(state remembered per browser); the full **Unscheduled** tab remains the place to edit, delete, and
restore inventory. On narrow screens the rail becomes a horizontal strip above the grid.

Both the rail and the Unscheduled tab split their items into **Ready to schedule** and a collapsed
**Already on calendar** group. An inventory item lands in the latter when it matches a scheduled post
by Canva design id, shared media (image / video / carousel slide path), or normalized title — client-side
detection over live state, so it also catches duplicates that only exist in a browser's localStorage.
Matched cards are de-emphasized and non-draggable: they show **On &lt;date&gt; →** (jumps the calendar to
that month and briefly flashes the post's chip), a per-card **Archive** and a group **Archive all** that
reversibly hide them (restore from the Unscheduled tab), and — in the tab only — **Add again →** to re-post
a fresh copy. The **Unscheduled (N)** counts everywhere reflect only the truly-unscheduled (ready) items.
Separately, scheduled posts with no social caption are flagged with a small **✍ / "Needs caption"** marker
on chips, cards, and the lightbox, and totalled in a **Missing captions** header stat.

## Sync across machines

State mirrors to each browser's `localStorage`, and syncs through `data/calendar.json` in this repo.

- **Publish changes:** writes your current schedule + inventory to `data/calendar.json` via the GitHub
  API. The first push asks for a **fine-grained Personal Access Token** with **Contents: Read & Write**
  on this repo. The token is stored **only in that browser's localStorage** — it is never written into
  the page or the repo.
- **Sync ↓ (pull):** fetches the latest `data/calendar.json` and merges newer entities into local state.
- **Conflict guard:** Publish changes warns before overwriting remote data that changed since your last pull.
- A fresh machine **auto-pulls** the shared state the first time it opens (once a push exists).
- **Export / Import** JSON also work for manual backup/sharing.

Create a token at https://github.com/settings/tokens?type=beta (Resource owner: morganb180,
Repository access: only `opendoor-content-calendar`, Permissions → Contents: Read and write).

## Previews & videos

- Image previews and swipeable carousel slides live in `previews/` and work on the hosted site.
- **Video spots** with local `~/opendoor/` paths are labeled **LOCAL ONLY** and play only on Morgan's machine.
  To make them play remotely, upload the mp4s to the asset host and update `media.video` in `data/calendar.json`.

## Social captions & Canva

Each post has two text fields:

- **Caption / notes** — internal notes about the post (existing field).
- **Social caption** — the actual caption text that goes live with the post on IG/FB.

When a post has a **social caption**, the edit form shows **Copy caption** so you can paste the text
into Canva manually. Normal Canva design links still open in Canva. Browser-side Canva Autofill is
intentionally removed because it depends on an API/tier/token model that does not fit this static
GitHub Pages app.

## Importing Canva links

Use **Import from Canva** to paste raw Canva design URLs or batch rows and create calendar-ready
drafts without hand-entering each item. The import currently runs entirely in the browser; it does
not scrape Canva or require the Canva API.

Supported input:

- One Canva URL per line — imports as unscheduled inventory with the design ID as the title.
- Batch rows — `URL, date, theme, title, social caption`.
- Comma, tab, or pipe-delimited rows.
- Dates in `YYYY-MM-DD` or `M/D/YYYY` format.

After parsing, the preview table lets you edit titles, themes, dates, and social captions or remove
rows before saving. By default, imported items go to **Unscheduled inventory** so you can review,
preview, and add them to the calendar. If you choose **Schedule rows with dates**, only rows with a
parsed date are placed directly onto the schedule; undated rows still go to inventory. Use **Use
sample** in the modal to see the expected format.

This is the pragmatic workflow bridge until a deeper Canva generation/API process exists. A future
Canva Connect integration can enrich these imported drafts with metadata, exports, or thumbnails
once OAuth/scopes and a reliable design convention are in place.

## Internal comments

Each post and inventory item has a **comments thread** in the lightbox preview panel. Comments
are stored in localStorage and synced via the same `data/calendar.json` mechanism (Publish changes / Sync ↓).
The first comment asks for your name (stored in localStorage for future comments).

Comments show a 💬 count on the month-grid chip and are visible in the lightbox.

## Mobile support

The calendar is fully responsive:

- Month grid collapses to compact cells on phones (thumbnails only, no titles)
- Edit modal becomes full-screen
- Lightbox stacks vertically (media on top, info/comments below)
- Inventory cards switch to single-column
- Touch-friendly button sizes and spacing

## Data model

`data/calendar.json` (schema `version: 7`) is the **source of truth** — scheduled posts,
inventory, holiday/event markers, and comments all live there, not in `app.js`. The app loads
it on start, and `data/activity.jsonl` is an append-only audit trail of writes (rendered as the
**Recent changes** feed in the UI).

Two ways to edit it:

- **Through the UI** — drag a card from the **Unscheduled rail** onto a day (or **Schedule →** /
  tap-to-place), drag a chip back to the rail to unschedule, move chips between days, **+ Add post**,
  **+ Add inventory item**, edit modal. Changes persist to `localStorage` immediately and mark an
  amber **unpublished-edits** dot on **Publish changes**; use **Publish changes** to write them to
  `data/calendar.json` (see below) and **Sync ↓** to pull another machine's changes.
- **Through `tools/calctl`** — the one-command CLI write path for registering finished assets from
  a Claude Code session. See `CLAUDE.md` and `docs/WORKFLOW.md` for the exact commands (`calctl add`,
  `calctl schedule`, `calctl deploy`, …).

## calctl

`tools/calctl` is the CLI write path for the calendar (Node >= 18, zero npm dependencies).
It edits `data/calendar.json` (schema v7), copies preview images into `previews/`
(slides into `previews/slides/<id>/`, warning above the 300 KB budget), and bumps
`updatedAt` on every write. Run from the repo root:

```sh
tools/calctl add --title "Fireworks Wordmark" --theme seasonal --fmt "Video · 9:16" \
  --date 2026-07-04 --img ~/opendoor/finals/fireworks-wordmark/poster.png --canva DAHOFu7Evxs
tools/calctl add --title "Offer math carousel" --theme proof --fmt "Carousel · 6 slides" \
  --inventory --slides ~/opendoor/finals/offer-math/slides     # no --date -> inventory
tools/calctl schedule <id|title-substring> 2026-08-05          # inventory -> calendar, id kept
tools/calctl move <id> 2026-08-07
tools/calctl set <id> status=posted postedUrl=https://…        # also title/theme/img/video/…
tools/calctl rm <id>
tools/calctl list --month 2026-07 --status scheduled [--json]
tools/calctl import-canva "https://www.canva.com/design/DAxxx/view, 2026-08-12, meme, Title, Caption"
tools/calctl validate [--json]                                 # runs scripts/validate-data.js
tools/calctl deploy -m "Add fireworks post" [--no-push]        # validate -> add data/ previews/ -> commit -> push
```

Notes: `--canva` accepts a bare `DA…` id or any canva.com URL. Local video files are not
committed; upload to the asset host and pass the https URL (or `--allow-local` for
Morgan-machine-only playback). `--data path/to/calendar.json` points any command at an
alternate data file for testing. `deploy` refuses to push on validation errors and never
force-pushes.
