# Decision Log

Short, dated record of choices made against `docs/BUILD_SPEC.md` that aren't obvious from the
code. Add an entry when a spec option is picked, deferred, or ruled out.

---

## 2026-07-06 — F10 ES-module split: WAIVED

BUILD_SPEC F10 flagged the monolith `app.js` (then ~820 lines, currently ~680) as a candidate for
an ES-module split. Waived for now: a single-file `app.js` is accepted under the project's
no-build constraint (no bundler, no `<script type="module">` chunking to manage across GitHub
Pages). The tooling side is already modularized (`tools/lib/*`), which covers most of the
maintainability concern.

Revisit if `app.js` exceeds roughly **1000 lines** — at that point the split pays for itself even
without a build step (native multi-file `<script type="module">` includes, no bundler needed).

## 2026-07-06 — Phase 3.2 team roles: OPTION B (Morgan-mediated)

BUILD_SPEC §5 Phase 3.2 offered two options for how teammates interact with the calendar:

- **Option A** — zero-token comments via a small Cloudflare Worker holding a scoped PAT.
- **Option B** — teammates view and comment in their own browser (stored locally); Morgan runs
  **Publish changes** / `calctl deploy` to land everything, including their comments.

**Option B chosen for now.** Teammates don't need write tokens today, and standing up the Worker
is extra infra for a team that's currently comment-only. Option A is deferred, not rejected.

**Awaiting Morgan's confirmation** (BUILD_SPEC §10 Q1: "Should teammates be able to move/edit
posts, or only comment?"). If the answer is "more than comment," Option A's scope changes and
should be re-estimated before building it.

## 2026-07-06 — Canva Autofill push: permanently out

BUILD_SPEC §6.2 already flagged Autofill as Enterprise-gated and a poor fit for a static page;
this closes the question rather than leaving it open. Browser-side Canva Autofill push will not
be built — the API requires an Enterprise tier and a token/CORS model that doesn't work from a
static GitHub Pages app.

Canva integration stays where it already works well: `canva.com/design/<id>/view` links out, the
client-side URL/batch **Import from Canva** parser, and — per §6.2 v2 — a future `calctl canva
pull` (local OAuth, CLI-side) for pulling titles/thumbnails. Any deeper Canva automation is
calctl-side, not browser-side.
