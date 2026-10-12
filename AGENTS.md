# Working on vibe hacker

Single-file, no-build idle-RPG: `index.html` (HTML/CSS/JS inline, one big IIFE). Open it directly in a
browser; no server, bundler or `npm install`. GitHub Pages deploys straight from `main`, so
**anything merged to `main` goes live immediately**; nothing half-finished lands there. Only
`index.html` deploys.

History, architecture notes and accepted simplifications: `docs/agent-background.md` (read when
touching the area).

## Where things live

| File | Purpose |
|---|---|
| `index.html` | The entire game |
| `README.md`, `guide.md` | Player-facing overview / mechanics reference |
| `docs/agents-and-queues.md` | **Active rewrite** (branch `agents-and-queues`). Its `## Status` and Phase checkboxes say where to pick up. `main` runs the old game, so merge only when playable end to end |
| `docs/window-manager.md` | Phased plan for the OS-style window UI (Phases 1-4 shipped); check its `## Status` |
| `docs/crafting-update.md` | **Completed** itemization plan; historical only |
| `tools/` | Node harnesses (see Verifying) |
| `docs/agent-background.md` | Moved-out history, architecture notes, balance-validation detail |

Work items (backlog and new ideas) are GitHub Issues on `basmith7/vibe-hacker`. A large or
multi-phase idea gets its own phased design doc under `docs/` (like `window-manager.md`), linked from
its issue. `docs/ideas.md` is a staging inbox with an owner-only section: don't action or move items
there.

**Docs are part of "done".** A change to what a player sees or does updates `guide.md`/`README.md` in
the same piece of work.

## Invariants and traps in `index.html`

- All state is one object `P` built by `defaults()`; `PERSIST` lists the saved keys. A new persisted
  field goes in both. Runtime-only `a.m` and `a.immune` are stripped in `save()`: never add them.
- **No save migrations.** If a change alters an existing field's *shape*, bump `SAVE_VER` and move
  on; no backfill code. A mismatched save boots into the Guru Meditation screen and is wiped.
- **OS tier (`P.up.os`, index into `OS_TIERS`) is the milestone spine.** Gate new things behind an OS
  via `osLock(u)`, not a bespoke conditional.
- `seatedQueue(a)` returns `null` on the Bench; never fall back to `P.queues[0]` (that would make the
  Bench the Backlog). `seatAgent(a, qi)` is the only way an agent changes queue after hire.
- `queueMods(q)` is the only mod read and is never cached on `q`, so (un)socketing needs no
  `recompute()`. `socketConfig`/`unsocketConfig` are the only writers of `q.configs`.
- `goRogue`/`recoverRogue`/`kill9` are the only rogue transitions; new rogue modes are
  `ROGUE_MODES` rows.
- Call `recompute()` after anything touching gear, patches or `P.equity`; it loops `agentMult(a)` and
  is cheap. `MULT` is vestigial: don't add to it.
- **`BAL` is the single tunables table**, mirrored 1:1 in `tools/aq-sim.mjs` (its `T` table). Change a
  number in both, re-check with `--probe`, never inline a magic constant into the game loop.
- **Data-driven tables, not scattered branches.** New content is an entry in `AGENT_STATS`,
  `AGENT_SLOTS`, `QUEUE_TIERS`, `PATCH_DEFS`, `MATS`, `UPG`, `ACH`, `CRAFT_ACTIONS`, etc. Reorder the
  IDE crafting ring by reordering `CRAFT_ACTIONS`.
- Store/gear UI builds DOM once and updates on a timer; follow the `slotEls`/`matEls` caching pattern.
  Team cards come from `QUEUE_TIERS`; `isRevealed()` owns the Team section's visibility.
- **1920x1080 is the reference resolution.** CSS sizes are fixed px; `fitScale()` applies a CSS `zoom`
  on `:root` above it (cap 3x). `getBoundingClientRect()` is zoom-scaled but stored window rects are
  not (drag/resize divide by `uiZoom`). Anything measuring the canvas must run after `fitScale()`,
  which is why `defaults()` leaves `P.windows` null for boot to seed.
- Window defaults come from `WIN_LAYOUT` (`{c, r, h}`); each column's heights must total `WIN_ROWS`.
- New themed surfaces should carry the `card` class to get every OS look. Those theme rules use
  `!important`, so your own semantic colour (rarity, ready state) needs `!important` too.
- Era fonts (base64 woff2 in `<style id="eraFonts">`): don't subset or edit; Share Tech Mono has an
  OFL Reserved Font Name, so changing its glyphs would require renaming it.

## Verifying changes (no unit tests)

Use the harnesses in `tools/` before hand-rolling a script:

- **`node tools/smoke.mjs <scenario>`** drives headless Chrome and prints `PASS`/`FAIL`. Run every
  scenario in `SCENARIOS` (~15 min) before calling a change done. Add a scenario rather than weakening
  one.
- **`tools/aq-sim.mjs`** is the balance source of truth (`--checks`, `--table`, `--kps`, `--craft`,
  `--hours`, `--probe`). Argue balance changes there first.
- **`tools/validate-rate.mjs`** checks the live game against the model, e.g.
  `FIX='{"agents":3,"ilvl":10}' node tools/validate-rate.mjs 0 60` vs
  `FIX='{"agents":3,"ilvl":10}' node tools/aq-sim.mjs --probe --craft 0`. Expect agreement within ~20%
  at kps 0. `--probe` counts ticket income only, so live bounty income reads higher: not drift. Fixture
  options and noise caveats are in `docs/agent-background.md`.

For an ad-hoc CDP script (headless Chrome with `--remote-debugging-port`, poll `/json` for
`webSocketDebuggerUrl`, `Runtime.evaluate` with `returnByValue:true`):

- **Save fixtures:** `localStorage.setItem('vibehacker', JSON.stringify(save))`, then immediately
  `localStorage.setItem=function(){}` **before** `location.reload()`, or the `beforeunload` `save()`
  clobbers it. `delete localStorage.setItem` afterwards if later saves must persist.
- **IIFE internals are unreachable from `Runtime.evaluate`**: `mashCode()`, `WK` etc. silently return
  `undefined`. Drive the game with `Input.dispatchKeyEvent` or `document.querySelector(...).click()`.
- Check both `Runtime.exceptionThrown` events and `result.exceptionDetails`.
- `Page.captureScreenshot` for layout/rendering changes.

## Git

Branch per feature/phase; full verify pass before merging to `main` (it auto-deploys). Commit messages
are written for a reader of `git log` with zero other context.
