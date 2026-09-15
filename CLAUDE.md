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
| `index.html` | The entire game. Single `<script>` IIFE, ~2,850 lines. |
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

In progress: `docs/window-manager.md`, a phased plan (Phases 1–4 shipped, Phase 5 next — check its
`## Status` line) reworking the UI into an OS-like progression: a day-1 minimal terminal → tmux-style
tiled panes as apps are purchased one by one → draggable/minimizable windows + Start Menu unlocked by
the earned "Windows 3.1" OS tier (`P.up.os >= 1`). Phase 3 moved the stats/HUD into a Status app and
slimmed the top strip into a taskbar; Phase 4 turned the entire shop into apps (Store + Equipment/
Inventory/IDE/Missions, each purchase-gated) and **retired the slide-out shop drawer entirely** — so
the shop `#shop` aside and `buildShop`/`buildToolbox` now render into `#grid` app panels, not a drawer. It also absorbed two `todo.md` items (theme-CSS dedup, onboarding
reveal polish) — see its "Backlog absorbed" section.

## Architecture inside `index.html`

- All game state lives in one object, `P`, built by `defaults()`. `PERSIST` is the array of `P`
  keys that actually get saved (via `save()`, to a cookie + localStorage mirror). Adding a new
  persisted field just means adding it to both `defaults()` and `PERSIST` — if a save doesn't
  have that key, `P` simply keeps whatever `defaults()` set for it, since `loadState()` only
  overwrites keys that are present in the loaded JSON.
- **No save migrations — ever.** (User decision, 2026-09-14: the player base is the user plus
  friends, so old saves are simply invalidated.) `SAVE_VER` is strict: a save whose `ver` doesn't
  match boots into the **Guru Meditation** easter-egg screen (`guruMeditation()`, Amiga-style red
  box) and is wiped on click. So whenever a change transforms an existing field's *shape* (not just
  adds a new one), bump `SAVE_VER` and move on — don't write grandfather/backfill code. The old
  key-sniffing migration ladder that used to live in `loadState()` was deleted for this reason.
- **The OS tier (`P.up.os`, index into `OS_TIERS`) is the milestone spine.** It gates hardware slots
  (`SLOTS[].os`), the agent cap (`HIRE_CAP`), Automation items (`UPG[].reqOs`), the window paradigm
  (`wmFloat()`), item-level caps and retro item names. `osLock(u)` is the single check the Store uses;
  when gating something new behind an OS, hang it off that rather than adding a bespoke conditional.
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
- **1920×1080 is the reference resolution.** Every font size/padding/border in the CSS is a fixed px
  value tuned for it. `fitScale()` sets a CSS `zoom` on `:root` for anything larger (capped at 3×),
  so the logical canvas stays ~1920 wide no matter the display; below the reference it holds at 1× and
  the fluid layout takes over. Two consequences to remember: `getBoundingClientRect()` is zoom-scaled
  while stored window rects are not (drag/resize divide by `uiZoom`), and anything measuring the canvas
  must run **after** `fitScale()` — which is why `defaults()` leaves `P.windows` null for boot to seed.
- **Float-mode window defaults are computed, not hardcoded.** `WIN_LAYOUT` holds each app's slot as
  `{c, r, h}` grid units (4 columns × 7 half-rows) and `defaultWindows()` scales that to the live
  `#grid` size, so Reset Layout fits whatever screen the player has. Change an app's share of the
  screen by editing its `h` — but every column's heights must still total `WIN_ROWS`.
- **Deep Work (`syncFocusMode`) is the fullscreen bonus.** Detection needs *both* the Fullscreen API
  and the `display-mode: fullscreen` media query — F11 only triggers the latter. Effects are applied
  in `recompute()` behind `focusOn`, so any new multiplier gets them for free.
- **The IDE crafting bench is a ring, not a list.** `CRAFT_ACTIONS` is the single table driving it:
  each row carries its material, label, unit-circle `x`/`y` position, validity predicate and the
  reason string shown when it's unavailable. `fitBench()` (a `ResizeObserver` on `#benchWrap`) sizes
  the ellipse and the centre socket in JS and flips to a stacked `.narrow` fallback under ~270px.
  Reordering the ring = reordering that table.
- **New themed surfaces should carry the `card` class.** The per-era theme CSS is long repeated
  selector lists that include `.card`, so anything given that class gets every OS look for free
  (this is how the bench socket/orbs are themed). The catch: those rules use `!important`, so a
  semantic colour of your own (rarity, ready state) needs `!important` too.

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

- OS-locked Store cards still *reveal* on the normal 50%-saved rule and just show a 🔒 button, so a
  player can see a thing they can't buy yet. Intentional: it's the roadmap. The Equipment app does the
  same for locked slots.

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
