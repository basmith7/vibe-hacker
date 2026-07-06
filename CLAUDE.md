# Working on vibe hacker

Context for whichever agent/model is picking this project up — none of this is derivable just by
reading the code, so it's written down here instead of living only in a chat history.

## What this is

A single-file, no-build-step idle-RPG game (`index.html` — HTML/CSS/JS all inline, one big IIFE).
Deployed via GitHub Pages straight from `main` — **anything merged to `main` goes live immediately**,
so nothing half-finished lands there. Double-click `index.html` to run it locally; no server,
no bundler, no `npm install`.

## File map

| File | What it's for |
|---|---|
| `index.html` | The entire game. Single `<script>` IIFE, ~2,150 lines. |
| `README.md` | Player-facing project overview (what the game is, controls, license). |
| `guide.md` | Player-facing mechanics reference (every stat/upgrade/system explained in detail). |
| `todo.md` | Standing backlog of future ideas (formalized, but not commitments). Root, because it's the primary agent-facing worklist. |
| `docs/ideas.md` | **Staging inbox** — raw ideas before they're formalized. Two sections with a specific workflow; see "Idea-intake workflow" below. |
| `docs/crafting-update.md` | A **completed** 7-phase itemization design+delivery doc (see below) — a historical record now, not an active plan. Its own `## Status` line says so. |
| `docs/window-manager.md` | An **active, in-progress** phased design+delivery doc (same format as `docs/crafting-update.md`) for turning the fixed panel grid + shop drawer into a real draggable/minimizable window system. Note: the design has since shifted so the moveable-window desktop is an *earned "Windows 3.1" upgrade*, with a tmux-style tiled terminal as the pre-upgrade UI — check its `## Status` line and top sections before assuming anything about the current UI's structure. |

Design docs and the idea inbox live under `docs/`; player-facing docs (`README.md`, `guide.md`) and
the primary worklist (`todo.md`) stay in root. Only `index.html` deploys, so file layout is purely
for navigation.

**Docs are part of "done," not a follow-up.** Any change that alters what a player sees or does
should update `guide.md`/`README.md` in the same piece of work, not as a separate pass later.

## Idea-intake workflow

Ideas flow through `docs/ideas.md` before becoming real work. It has two sections, and the
distinction is about **who acts**, not just how mature the idea is:

- **🌱 Still planning** — the *user's* thinking space. You may add input as indented sub-bullets
  (questions, tradeoffs, what the code already does), but do **not** action, formalize, or move these.
- **📥 Ready** — the user has blessed these; they're yours to route out. Routing means: small idea →
  a line in `todo.md`; large/multi-phase idea → its own phased design doc under `docs/` (like
  `window-manager.md`). **Delete each item from `ideas.md` once routed** — that file is a staging
  area, not a second backlog.

So the pipeline is: `ideas.md` 🌱 → `ideas.md` 📥 → `todo.md` **or** a new `docs/*.md` design doc.

## Current state (as of the last major work)

The "crafting update" — a Path-of-Exile-style itemization overhaul — is fully shipped across all
7 of its planned phases (see `docs/crafting-update.md`'s Status line for the detailed retrospective of
each). In short: the old flat repeatable Hardware upgrades are gone, replaced by 8 equip slots fed
by drops/gambling, a Toolbox stash + IDE crafting bench, patches/rarity, a materials economy, a
rotating Mission Board, and endgame depth (item-level caps, set bonuses, Legendary uniques). Any
further itemization work (rebalancing, more content) is now regular `todo.md` backlog, not a new
phase of that plan.

In progress: `docs/window-manager.md`, a phased plan (Phases 1–2 shipped, Phase 3 next — check its
`## Status` line) reworking the UI into an OS-like progression: a day-1 minimal terminal → tmux-style
tiled panes as apps are purchased one by one → draggable/minimizable windows + Start Menu unlocked by
the earned "Windows 3.1" OS tier (`P.up.os >= 1`). It also absorbed two `todo.md` items (theme-CSS dedup, onboarding
reveal polish) — see its "Backlog absorbed" section.

## Architecture inside `index.html`

- All game state lives in one object, `P`, built by `defaults()`. `PERSIST` is the array of `P`
  keys that actually get saved (via `save()`, to a cookie + localStorage mirror). Adding a new
  persisted field just means adding it to both `defaults()` and `PERSIST` — if an old save doesn't
  have that key, `P` simply keeps whatever `defaults()` set for it, since `loadState()` only
  overwrites keys that are present in the loaded JSON. Real migration code is only needed when an
  old save's *shape* needs transforming (e.g. merging two old stats into one new one), not just for
  brand-new fields.
- `loadState()` detects old-format saves by presence/absence of specific keys in the raw parsed
  JSON (not by bumping a version number), then backfills/transforms in place. Read this function
  before adding a new migration — there's a running history of every past migration in there, each
  commented with which phase/change it's for.
- `recompute()` derives the `MULT` (multipliers: speed/xp/credit/crit/etc.) and `GEAR` (equipped-item
  patch sums) objects from current stats/upgrades/equipped hardware. Call it after anything that
  changes equipment, upgrades, or stats-in-a-way-that-matters — it's cheap, safe to over-call.
- **Data-driven tables, not scattered conditionals.** New content is almost always a new entry in a
  table (`SLOTS`, `PATCH_DEFS`, `MISSION_DEFS`, `MATS`, `UPG`, `LEGENDARIES`, `ACH`, `TASKS`, `STATS`,
  etc.) plus maybe a small function, rather than new branches spread through the game loop. This is
  the pattern that kept 7 phases of itemization additions easy — keep using it.
- The shop UI (`buildShop()`/`renderShop()`, `buildToolbox()`/`renderToolbox()`) rebuilds its DOM
  once and then just updates text/classes on a timer — look at the existing `slotEls`/`matEls`/etc.
  caching pattern before adding a new shop section.

## Verifying changes (there is no test suite)

This project has no automated tests. Verification is done by driving a real headless Chrome
instance via the Chrome DevTools Protocol (CDP) from throwaway Node scripts. The recipe, proven
across every phase of this project:

1. Spawn Chrome pointed at the file directly:
   `google-chrome --headless=new --disable-gpu --no-sandbox --remote-debugging-port=<N> --user-data-dir=<scratch-dir> file:///path/to/index.html`
2. Poll `http://localhost:<N>/json` for the page's `webSocketDebuggerUrl`, connect to it with a
   plain `WebSocket`, send `Runtime.enable`, then use `Runtime.evaluate` (`returnByValue:true`) to
   read/inject state.
3. **Injecting a save fixture is a two-step dance**: `localStorage.setItem('vibehacker', JSON.stringify(saveObj))`
   then *immediately* `localStorage.setItem=function(){}` **before** `location.reload()` — otherwise
   the app's own `beforeunload`-triggered `save()` clobbers your fixture with a fresh/default state
   partway through the reload. Restore it with `delete localStorage.setItem` after the reload if you
   need further real saves to persist during that same test.
4. **Functions/variables inside the game's IIFE are not reachable from `Runtime.evaluate`** — it runs
   in the page's outer global scope, and the whole game is wrapped in `(function(){ ... })()`.
   Calling something like `mashCode()` or reading `WK` directly from an eval will silently return
   `undefined` (not throw) rather than actually driving the game. To simulate real play, dispatch
   actual input: `Input.dispatchKeyEvent` (`keyDown`/`keyUp`) for keyboard, or click real DOM
   elements via `Runtime.evaluate`'s `document.querySelector(...).click()`.
5. Check **both** `Runtime.exceptionThrown` events *and* `result.exceptionDetails` on each eval's
   return value — a broken eval can fail silently if you only watch one of the two.
6. `Page.captureScreenshot` for a visual sanity check when a change affects layout/rendering.

## Git workflow

- Branch per feature/phase (e.g. `phase7-depth-polish`), full verify pass on the branch, merge
  `--no-ff` into `main`, delete the branch, push. Small, low-risk, already-double-verified cleanups
  (e.g. a pure dedup with no behavior change) have been committed straight to `main` as an
  acknowledged exception — not the default.
- Never commit unless the user asks. Detailed commit messages, written for someone reading `git log`
  later with zero other context.

## Known, deliberate simplifications (not bugs)

- Legendary Build items aren't patch-locked — Commit/Hotfix/Refactor/Revert all still work on them,
  so a Reverted Legendary keeps its unique name with 0 patches. Accepted tradeoff, not an oversight.
- The DOS theme's `:root[data-theme="dos"] .card .buy{...!important}` CSS forces *all* `.card .buy`
  buttons to the same bright-green look, including disabled ones — so disabled buttons don't look
  visually dimmed under that theme specifically. Pre-existing, tracked under `todo.md`'s "DRY the
  theme CSS" item.
- Decommissioning gear refunds credits + a flat material amount regardless of rarity — rarity isn't
  factored into the refund. Reasonable simplification (patches are the point of good gear, not
  resale value), not a missed feature.

Keep this file up to date as conventions change — it's the one place this kind of context survives
a fresh session with no prior chat history.
