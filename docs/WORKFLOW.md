# Opendoor Content Calendar Workflow

## Source of truth

The repo is the database. Calendar content lives in `data/calendar.json`; previews live in `previews/`; the static site renders that data on GitHub Pages.

## Claude/local asset mode

1. Finish the asset under `~/opendoor/finals/<spot>/`.
2. Register it with `tools/calctl add ...`.
3. Run `tools/calctl validate`.
4. Publish with `tools/calctl deploy -m "Add <asset>"`.

Local videos are not committed here. `tools/calctl add --video <local.mp4>` refuses a local path by default and prints the hosting instruction: upload the mp4 to `morganb180/canva-asset-host` (raw URL) or another https host and rerun with `--video <URL>`. `--allow-local` is available only for Morgan-machine-only previews; those records store the `~/…` path with `localOnly: true`, and the UI labels the button honestly ("LOCAL ONLY"). If no `--img` is given for a local video, a poster frame is grabbed via `ffmpeg` when available. `validate-data` enforces that every `~/…` video sets `localOnly: true`.

## Canva mode

Use the site’s **Import from Canva** modal or `tools/calctl import-canva` to register Canva design links. Browser-side Canva Autofill is intentionally removed.

### Canva pull (enrich titles + thumbnails)

`tools/calctl canva pull` fetches a design’s real title and thumbnail from the Canva Connect API and fills them in, so imported records don’t stay as `Canva design DAH…` placeholders. It only overwrites placeholder titles and empty images — curated titles/previews are left alone unless you pass `--force`.

Set up the Connect integration once:

1. At <https://www.canva.com/developers/> create an integration and enable the **`design:meta:read`** scope.
2. Add redirect URL `http://127.0.0.1/callback` (any loopback port is accepted; the CLI picks a free one).
3. Provide the Client ID via `export CANVA_CLIENT_ID=OC-…` or `~/.config/opendoor-calendar/config.json` (`{ "clientId": "OC-…" }`). If the integration issued a secret, add `CANVA_CLIENT_SECRET` / `"clientSecret"` too.

Then:

```sh
tools/calctl canva pull --all        # every record with a Canva id
tools/calctl canva pull DAHxxxxxxxx  # one design
tools/calctl canva pull --all --force  # also refresh curated titles/images
```

First run opens a browser to authorize; the OAuth token is cached at `~/.config/opendoor-calendar/tokens.json` (0600) and auto-refreshes after that. Downloaded thumbnails land in `previews/canva/<id>.jpg`. Per-design API errors (missing scope/tier, deleted design) warn and skip; the record is left valid. `tools/calctl canva logout` clears the cached token. With nothing configured the command prints this setup guide and exits without touching data.

## Team usage

Viewers open the Pages URL, unlock the deterrence gate, preview assets, and leave comments. Morgan publishes changes with **Publish changes** or `tools/calctl deploy`. Use **Sync ↓** before editing when another machine may have newer data.

## Validation

Run:

```sh
node scripts/smoke-test.js
node scripts/dom-smoke-test.js
node scripts/validate-data.js
node scripts/optimize-images.js
```

CI runs the same checks on push and pull request. `validate-data` also enforces that every local `~/...` video has `localOnly: true`.

`tools/calctl` appends write actions to `data/activity.jsonl` for add/schedule/move/set/remove/import/canva-pull operations, plus a `deploy`/`publish` entry on each `deploy` (logged before the commit so it ships in the same commit). A weekly GitHub Actions link check verifies Canva, posted, and hosted video URLs where public HTTP checks are possible.
