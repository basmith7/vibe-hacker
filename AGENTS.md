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
| `index.html` | The entire game. Single `<script>` IIFE. |
| `README.md` | Player-facing project overview (what the game is, controls, license). |
| `guide.md` | Player-facing mechanics reference (every stat/upgrade/system explained in detail). |
| `docs/agents-and-queues.md` | **The active rewrite** — the phased design+delivery doc for the Agents & Queues restructure being built on branch `agents-and-queues`. Its `## Status` line and Phase checkboxes are the source of truth for where to pick up. |
| `tools/` | Node harnesses: `smoke.mjs` (headless-Chrome scenarios — the verification entry point), `aq-sim.mjs` (balance model + `--probe`), `validate-rate.mjs` (live game vs. model), `balance-sim.mjs` (the old economy on `main`). |
| `docs/crafting-update.md` | A **completed** 7-phase itemization design+delivery doc — a historical record now, not an active plan. Its own `## Status` line says so. |
| `docs/window-manager.md` | An **in-progress** phased design+delivery doc (Phases 1–4 shipped, Phase 5 next — check its `## Status` line) for the UI progression: tmux-style tiled terminal first, then a draggable/minimizable window desktop earned with the "Windows 3.1" OS tier. |

Design docs live under `docs/`; player-facing docs (`README.md`, `guide.md`) stay in root. Work
items (the backlog and new ideas) are GitHub Issues on `basmith7/vibe-hacker`. Only `index.html` deploys, so file layout is purely
for navigation.

**Docs are part of "done," not a follow-up.** Any change that alters what a player sees or does
should update `guide.md`/`README.md` in the same piece of work, not as a separate pass later.

## Idea intake

New ideas are GitHub Issues. Small ideas stay an issue; a large or multi-phase one gets its own
phased design doc under `docs/` (like `window-manager.md`), linked from its issue.

## Current state

The Agents & Queues rewrite restructures the game around a **Desktop** (your machine — OS ladder, apps,
queues and their seats) and **Agents** (a roster where every agent, including you, has the same sheet:
three stats, four gear slots, inventory, sanity, no levels). Phases 1–3 are shipped on branch
`agents-and-queues`; Phase 4 (Automation, rogue types, Red Team, docs pass) is next — see
`docs/agents-and-queues.md` `## Status`. `main` still runs the old game and auto-deploys, so the branch
merges only when the rewrite is playable end to end.

## Architecture inside `index.html`

- All game state lives in one object, `P`, built by `defaults()`. `PERSIST` is the array of `P`
  keys that actually get saved (via `save()`, to a cookie + localStorage mirror). Adding a new
  persisted field just means adding it to both `defaults()` and `PERSIST` — if a save doesn't
  have that key, `P` simply keeps whatever `defaults()` set for it, since `loadState()` only
  overwrites keys that are present in the loaded JSON.
- **No save migrations.** The players are Brian and friends, so old saves are simply invalidated.
  `SAVE_VER` is strict: a save whose `ver` doesn't
  match boots into the **Guru Meditation** easter-egg screen (`guruMeditation()`, Amiga-style red
  box) and is wiped on click. So whenever a change transforms an existing field's *shape* (not just
  adds a new one), bump `SAVE_VER` and move on — don't write grandfather/backfill code. The old
  key-sniffing migration ladder that used to live in `loadState()` was deleted for this reason.
- **The OS tier (`P.up.os`, index into `OS_TIERS`) is the milestone spine.** It gates the queue tiers
  (`QUEUE_TIERS[].os`), the agent cap (`HIRE_CAP`), the item-level ceiling (`ILVL_CAP`), Automation items
  (`UPG[].reqOs`), the window paradigm (`wmFloat()`) and retro item names. `osLock(u)` is the single check
  the Store uses; when gating something new behind an OS, hang it off that rather than a bespoke conditional.
- **Agents and queues are the two state arrays.** `P.agents[]` — `{id, name, color, gear:{model,memory,
  compute,tools}, inv, sanity, q (−1 = Bench), done, failed, rogue:{mode,t,stolen}|null}`, agent zero is
  you (manual; hires are automatic) — and `P.queues[]` — `{tier, seats, mods, configs}`, one entry per
  owned queue, installed in `QUEUE_TIERS` order. `P.selectedAgent` is what the Equipment/Inventory/IDE
  apps act on; `P.craftSlot` is `{owner, item}`. The runtime-only fields `a.m` (derived stats) and
  `a.immune` (Kill -9 grace) are stripped in `save()` — never add them to `PERSIST`.
- **`seatAgent(a, qi)` is the only way an agent changes queue** after hire — it validates capacity via
  `canSeat`, abandons the in-flight ticket, recomputes and rebuilds the Queues app. The click-picker and
  drag-and-drop are both sugar over it. `seatedQueue(a)` returns `null` on the Bench; never fall back to
  `P.queues[0]` (that would silently make the Bench the Backlog).
- **Rogue is a table, not branches.** `ROGUE_MODES[mode].tick(a, dt, w)` runs at the top of `tickWorker`
  (so it pauses with the boss key and never runs offline); new modes are rows. `goRogue`/`recoverRogue`/
  `kill9` are the only transitions; `kill9Cost(a)` is `BAL.kill9PerIlvl × Σ gear ilvl`.
- **`queueMods(q)` is the only mod read.** It sums the `kind:"mod"` patches on `q.configs` into a
  `{d, pay, band, speed, mats}` vector every time it's called — never cached on `q`, so socketing or
  unsocketing needs no `recompute()`. `a.m.dur(D, q)` takes the queue (not just `D`) precisely so it
  can read the `speed` lever; `queueD`, `queueBandTop`, `a.m.payout` and `grantMaterials` are the other
  readers.
- **Configs are items with `slot:"config"`** — same shape as gear (`id, slot, name, ilvl, patches,
  maxPatches`), so stash cards, `INV_CAP`, decommission and `P.craftSlot` all work unchanged.
  `slotDef(item)` and `patchFits(def, item)` are the polymorphism points that let a Config skip the
  four equip slots and only take `kind:"mod"` patches (and gear only take non-mod ones).
  `socketConfig`/`unsocketConfig` are the only two places that write `q.configs`; both go through the
  same picker UI as seating (`openSocketPicker`).
- **Bounty pickup is derived, not stored.** `bountyWorked(q)` asks `WK` whether any non-manual worker
  already has `w.task.bounty && w.task.q === q` — so after a reload the next free agent just re-takes
  an unclaimed bounty. `tickBounties` (spawn/countdown/expiry) runs inside `tickProgress`, so bounty
  clocks pause with everything else the boss key and a hidden/closed tab pause; `offlineEarnings`
  ignores bounties entirely (Pager Integration, Phase 4, is the offline exception). `releaseBountyTasks`
  is what downgrades an in-flight bounty ticket to an ordinary one when its board's bounty expires
  mid-ticket. Faucets: ordinary tickets pay only credits + Commits (+ the LOC-milestone Full Rewrite);
  Hotfix/Refactor/Revert/Merge, gear near the top of a band, and Configs all come from bounties only.
- **`agentMult(a)` is the per-agent recompute.** It writes `a.m = {st, chance(D), dur(D), payout(D,q),
  sanityMax, regen}` from `agentStats(a)` (gear ilvl + patches + the `BAL.floor`), Equity and Deep Work.
  `recompute()` just loops every agent calling it — cheap, safe to over-call, call it after anything that
  touches gear, patches or `P.equity`. (`MULT` still exists but is vestigial; don't add to it.)
- **`BAL` is the single tunables table** — every number in the economy (stat coefficients, success and
  duration curves, payout exponent, sanity drain/regen, drop rate, hire/seat cost ladders) lives there and
  is mirrored 1:1 in `tools/aq-sim.mjs`. Change a number in one and change it in the other, then re-check
  with `--probe` (below); don't inline a magic constant into the game loop.
- **Data-driven tables, not scattered conditionals.** New content is almost always a new entry in a
  table (`AGENT_STATS`, `AGENT_SLOTS`, `QUEUE_TIERS`, `PATCH_DEFS`, `MATS`, `UPG`, `ACH`, `CRAFT_ACTIONS`,
  etc.) plus maybe a small function, rather than new branches spread through the game loop. This is
  the pattern that kept 7 phases of itemization additions easy — keep using it.
- The Store/gear UI (`buildShop()`/`renderShop()`, `buildToolbox()`/`renderToolbox()`) rebuilds its DOM
  once and then just updates text/classes on a timer — look at the existing `slotEls`/`matEls`/etc.
  caching pattern before adding a new section. The Team cards (`q_<tier>` Install and `seat_<tier>`
  Seat) are generated from `QUEUE_TIERS` at load rather than listed in `UPG` by hand, and `isRevealed()`
  owns the whole Team section's visibility (hidden until the Queues app is bought; install cards need
  the previous board; seat cards need their board).
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
  in `agentMult()` behind `focusOn`, so any new per-agent multiplier gets them for free.
- **The IDE crafting bench is a ring, not a list.** `CRAFT_ACTIONS` is the single table driving it:
  each row carries its material, label, unit-circle `x`/`y` position, validity predicate and the
  reason string shown when it's unavailable. `fitBench()` (a `ResizeObserver` on `#benchWrap`) sizes
  the ellipse and the centre socket in JS and flips to a stacked `.narrow` fallback under ~270px.
  Reordering the ring = reordering that table.
- **Era fonts are base64 woff2 in a separate `<style id="eraFonts">` block** right after the main
  `<style>`, so the ~100 KB of font data stays out of the way when you edit CSS. Themes use them via
  `--mono` (DOS, NEON) or a `body{font-family}` override (Win 3.1/95/10, STARSHIP). Credits live in
  that block's comment and in README's "Bundled fonts". Don't subset or edit the files: Share Tech
  Mono has an OFL Reserved Font Name, and changing its glyphs would mean renaming it.
- **New themed surfaces should carry the `card` class.** The per-era theme CSS is long repeated
  selector lists that include `.card`, so anything given that class gets every OS look for free
  (this is how the bench socket/orbs are themed). The catch: those rules use `!important`, so a
  semantic colour of your own (rarity, ready state) needs `!important` too.

## Verifying changes (there is no test suite)

There are no unit tests, but there are three Node harnesses in `tools/` — use them, don't hand-roll a
new throwaway script unless none of them fits:

- **`tools/smoke.mjs` is the verification entry point.** `node tools/smoke.mjs <scenario>` drives a real
  headless Chrome and prints `PASS`/`FAIL`. Run every scenario in `SCENARIOS` (tools/smoke.mjs, about
  15 min) before calling a change done.
  Add a scenario rather than weakening one. It also cleans up its own Chrome profile scratch dirs
  (`rmSync` on the `mkdtemp`'d dir in `done()`, skipped only under `--keep`) — don't reintroduce a leak
  there.
- **`tools/aq-sim.mjs` is the balance source of truth** — the expected-value model of the whole economy
  (`--checks` for the design-rule checks, `--table`, `--kps`, `--craft`, `--hours` for playthrough runs).
  Any balance change should be argued there first; `BAL` in `index.html` mirrors its `T` table.
- **`tools/validate-rate.mjs` checks the real game against that model.** `FIX='{"agents":3,"ilvl":10}'
  node tools/validate-rate.mjs 0 60` measures 60 s of live play for an N-agent Backlog fixture;
  `FIX='{"agents":3,"ilvl":10}' node tools/aq-sim.mjs --probe --craft 0` prints the model's number for the
  same state. They should agree within ~20% at kps 0; a bigger gap means a formula in one drifted from the
  other. Both accept `queues` (`[{tier, seats}]`) and `seat` (queue index per agent, `-1` = Bench) in `FIX`
  for multi-queue states, e.g. `FIX='{"agents":3,"ilvl":30,"queues":[{"tier":0,"seats":2},{"tier":1,"seats":1}],"seat":[0,0,1]}'`.
  Both also accept `mods` (`[{d,pay,band,speed,mats}, ...]` per queue index) — the validator synthesises
  one socketed Config per queue carrying a patch per nonzero lever, so a juiced board can be checked the
  same way. A 60 s window is noisy (ticket completions are lumpy); use 120 s before calling a gap drift.
  **`aq-sim.mjs --probe` reports ticket income only** (it mirrors what the validator measures — the
  validator's synthetic fixture sets `nextBounty` to effectively never fire, so neither side includes
  bounty income in this comparison); a live playthrough with bounties enabled will read further above
  the probe's number (bounties are 15–16% of income at every OS per `--checks`) — don't chase that gap
  as drift, it's the bounty term. Compare at a fixture with ≥90% success; at overreach the sim prices
  Kill -9 cycling into steady state and a 120 s live sample won't match that by design — the live game
  hasn't converged to the cycle average in that window. (`tools/balance-sim.mjs` models the *old*
  economy still on `main`.)

All of them use the same CDP recipe, which is also what to follow for an ad-hoc script:

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

Branch per feature/phase; full verify pass before merging to `main` (it auto-deploys). Detailed
commit messages for someone reading `git log` cold.

## Known, deliberate simplifications (not bugs)

- OS-locked Store cards still *reveal* on the normal 50%-saved rule and just show a 🔒 button, so a
  player can see a thing they can't buy yet. Intentional: it's the roadmap. The Equipment app does the
  same for locked slots.
- The DOS theme's `:root[data-theme="dos"] .card .buy{...!important}` CSS forces *all* `.card .buy`
  buttons to the same bright-green look, including disabled ones — so disabled buttons don't look
  visually dimmed under that theme specifically. Pre-existing; part of the theme-CSS DRY work.
- Decommissioning gear refunds credits + a flat material amount regardless of rarity — rarity isn't
  factored into the refund. Reasonable simplification (patches are the point of good gear, not
  resale value), not a missed feature.

Keep this file up to date as conventions change — it's the one place this kind of context survives
a fresh session with no prior chat history.
