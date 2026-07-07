# Window Manager — Design Plan

Turn the cockpit from a fixed panel grid + a slide-out shop drawer into a real desktop-style
window manager: draggable, minimizable, closable windows for each subsystem, a Start Menu to
relaunch anything, and a way to reset back to a clean default layout.

This ties together two things that turned out to be the same problem: the earlier "make the
day-1 → full-cockpit transition more gradual, any purchase order should look good" ask, and the
user's own vision for a modular, OS-like UI. A real window manager solves the first problem
architecturally — an app that isn't unlocked yet just isn't in the Start Menu, so there's no
single "everything appears at once" instant left to smooth over — rather than needing a cosmetic
patch on top of the current CSS-class-flip transition.

**Explicitly considered and rejected**: a lightweight CSS `animation-delay` stagger on the existing
`body.intro` → full-cockpit transition. Rejected as throwaway work — the whole reveal mechanism
gets rebuilt around windows in this plan, so patching the old mechanism first would just be redone.

## Status

**Phases 1–3 shipped.** Phase 1 (live on `main`, 2026-07-05): day-1 single terminal → tmux-style
tiling as apps unlock; manual mash split from the auto-agent swarm. Phase 2 (2026-07-06): owning the
Windows 3.1 OS tier (`P.up.os >= 1`) flips desktop tiling into a floating window manager — draggable/
minimizable/closable windows, Start Menu + Start button, Reset Layout, click-to-focus z-order. Phase 3
(2026-07-06): detail stats + level/stage HUD moved out of the always-on chrome into a **Status app**
(slimming the top strip to a real taskbar); dead lockmask retired. Phase 4 shipped in two chunks: **4a**
(the Store became a `#storePanel` app that tiles in at 10 credits) and **4b** (Equipment/Inventory/
IDE/Missions became purchase-gated apps and the shop drawer was fully retired). **The whole shop is
now apps; there is no drawer.** **Next: Phase 5 (onboarding + economy tuning; also a polish pass on
the float-mode default window arrangement) and Phase 6 (per-era window chrome + the deferred theme-CSS
DRY).** Major forks all decided.

Treat this doc as a living, resumable record (as with `crafting-update.md`'s 7 phases) — checkboxes
are the source of truth for where to pick back up, not a spec frozen at t=0.

## UI paradigm progression: terminal → tmux splits → Windows 3.1

**The moveable-window desktop is an earned upgrade, not the baseline.** (User direction,
2026-07-05.) The reveal arc is now three distinct UI paradigms, gated by progression, not one
window manager that's always on:

1. **Day 1 — a single minimal terminal.** A brand-new save shows *only* the terminal (mash code /
   Build·CI·Git). No panels, no shop drawer, no HUD clutter. This is the whole screen. It matches
   how the game actually starts — you type in a terminal before you have anything else.
2. **Early game — tmux-style tiling.** As the player **purchases each app one at a time**, each new
   app appears as a new pane in a tmux-style split of the terminal (tiled, non-floating, keyboard-
   /divider-driven — no free dragging yet). This is the DOS era. Buying things "one by one" is the
   pacing mechanism that replaces the old "everything appears at once" reveal — there's nothing to
   smooth over because apps literally aren't present until bought.
3. **"Windows 3.1" — the window manager unlocks.** This is **not a new upgrade to invent**: it's the
   existing **"Upgrade OS"** shop item (`UPG` id `os`, [`index.html`](../index.html) ~L763), whose
   tier 1 is literally `win31` (`OS_TIERS[1]`, cost 650). **Decision (user, 2026-07-05): reuse that
   tier.** The paradigm follows the *owned* OS tier, `P.up.os`:
   - `P.up.os === 0` (MS-DOS, tier 0) → **tmux tiling** era.
   - `P.up.os >= 1` (owns Windows 3.1 or later) → **floating windows + Start Menu**.

   This reuses the entire era ladder for free — no parallel "Windows 3.1" concept, no new persisted
   field, and it dovetails with everything already keyed off `P.up.os` (item-level caps, the Neural
   slot, retro gear names, achievements).

   Two consequences that fall out of reusing the tier:
   - **Follows owned tier, not the selected look.** `P.themeChoice` lets a player *display* an older
     look (e.g. own Win95 but theme back to DOS colors) independent of `P.up.os`. The window
     paradigm keys off the **owned tier** (`P.up.os`), *not* the chosen look — so themeing back to
     DOS keeps your floating windows; you don't lose your layout by clicking a theme. (Rejected
     alternative: paradigm-follows-look, i.e. picking the DOS look drops you to tmux — thematically
     cute but throws away window layouts on a cosmetic toggle.)
   - **Prestige drops you back to tmux.** "IPO / Cash Out" resets `P.up.os` to 0, so each prestige
     run genuinely rebuilds from a bare terminal and re-buys up to windows. **Decision: accept this**
     (consistent with how the rig already resets). Open thread the user raised: maybe let *some*
     cosmetic survive prestige as a prestige perk (a kept font? a badge?) — parked in open questions,
     not a Phase-1 blocker.

Implication: the floating window manager and the tmux tiling layout are **two separate render modes**
the same set of "apps" can live in, switched by `P.up.os >= 1`. An app is defined once (its content
DOM); the layout engine — tmux tiler vs. floating WM — is chosen at the top level. Keep the app
content decoupled from which mode is hosting it.

Still open (see bottom): exact unlock/purchase order + costs of the apps in the tmux era; whether
later OS eras (Win95→…→STARSHIP) gate further paradigm shifts or are pure reskins of the floating WM;
and the prestige-cosmetic-perk thread above.

## What becomes a window ("app")

**Decision (user, 2026-07-05): full purchase-gates up front** — every app except the day-1 terminal
is unlocked by buying it, one at a time. Today only `telemetry`/`globe` are gated
([`index.html`](../index.html) L757–758, `kind:"unlock"` + `P.unlocked`); this extends that same
data-driven `kind:"unlock"` pattern to the rest. So Phase 1 owns a real chunk of **economy design**
(costs, order, gating currency = credits), not just UI plumbing — reflected in the phasing below.

| App id | Title | Replaces / wraps | Unlock | Default state, new save |
|---|---|---|---|---|
| `terminal` | 💻 Terminal | the **manual mash-code surface** + build log (see mapping note) | **day 1 — the only thing on screen; free** | open; sole pane in a fresh save |
| `store` | 🛒 Store | current shop "Upgrades" tab | **bootstrap: auto-appears at a low credit threshold** (like today's shop-button reveal at 10cr) — it's how you buy everything else, so it can't itself cost credits | tiles in as 2nd pane once threshold hit |
| `agents` | 🤖 Agent Swarm | the *automated* agents in `#agentsPanel` | purchased (new `kind:"unlock"` item) | closed until bought; new pane when bought |
| `status` | 📟 Status | detailed stats from `#statusbar` + `#hud` (level/stage/stat chips) | purchased | closed until bought |
| `deploy_mesh` | 🌐 Deploy Mesh | current `#globePanel` | Go Global purchase (**existing** gate) | closed until unlocked |
| `telemetry` | 📊 Telemetry | current `#chartsPanel` | Install Telemetry purchase (**existing** gate) | closed until unlocked |
| `equipment` | 🔧 Equipment | current "Equipped Hardware" section | purchased (new gate) | closed until bought |
| `inventory` | 🧰 Inventory | current Toolbox stash + Roll-for-Hardware | purchased (new gate) | closed until bought |
| `ide` | 🛠 The IDE | current IDE + crafting-materials section | purchased (new gate) | closed until bought |
| `missions` | 📋 Missions | current Mission Board | purchased (new gate) | closed until bought |

**Day-1 terminal — mapping note (resolves the earlier ambiguity).** The thing you *type into* on day 1
to earn your first credits is today the **manual agent slot inside `#agentsPanel`** (the intro CSS
blows it up full-screen, [`index.html`](../index.html) L280–286), while `#terminalPanel` is only the
Build·CI·Git *log*. So the `terminal` app = **the manual mash surface** (what you hand-type into),
and the `agents` app = the **automated swarm you buy to stop hand-mashing** — which is also the
truer game story (mash by hand → buy agents to automate). Phase 1 has to physically separate the
manual slot from the automated agents in `#agentsPanel`; that untangling is called out as a Phase 1 task.

**Store bootstrap.** Since day 1 is *only* the terminal and everything else costs credits, the Store
can't itself be a purchase (chicken-and-egg). It auto-appears once you've earned a small amount —
reusing the existing "reveal the shop at 10 credits" mechanism from the intro funnel — then becomes
the hub you buy every other app from.

Ordering + exact costs of the new gates are the main remaining economy decision — see open questions.

## Window manager mechanics

- Each window: title bar (icon + title + minimize + close buttons), draggable via title-bar
  pointer-down + move, brought to front (z-order) and visually focused on click.
- **Minimize vs close** (decided — see open questions): for the Win3.1 era, treat them as the same
  action — the window disappears and is only reachable again via the **Start Menu**. No separate
  taskbar list of minimized apps distinct from closed ones. A per-app-icon dock/taskbar (where the
  minimize/close distinction could become meaningful) is a later-OS-era upgrade, not a v1 concern.
- **Resizing**: not required for v1. Most current panels already have reasonable fixed/min sizes.
  Flag as a Phase 5+ stretch if Telemetry/Inventory feel cramped in practice.
- **Persistence**: new `P.windows` object, one entry per app id: `{x, y, open, z}`. Follows this
  project's existing pattern exactly — add the key to `defaults()`/`PERSIST`, and any save that
  predates a given app simply falls back to `DEFAULT_LAYOUT`'s value for it, no bespoke migration
  needed for *that* part.
- **One real migration is needed**: the very first load of a save that predates the window system
  entirely. Seed `P.windows` from `DEFAULT_LAYOUT`, but set each gated app's `open` flag from its
  *existing* unlock state (e.g. `deploy_mesh` starts open if `P.unlocked.globe` is already `true`)
  so upgrading players don't lose access to something they already paid for.
- **Reset Layout**: restores `P.windows` to `DEFAULT_LAYOUT` wholesale (positions *and* which apps
  are open). Lives in the Start Menu. Distinct from "⟲ sudo rm -r /" (which wipes the whole save) —
  this only touches window arrangement, so a lightweight confirm (if any) is enough; nothing of
  substance is lost.

## Start Menu

- One button — see "OS chrome" below for where it lives — opens a menu listing every app.
- Unlocked apps: click to open (or focus, if already open).
- Locked apps (`deploy_mesh`/`telemetry` pre-purchase): shown grayed out with the same hint text
  the current lockmask already uses ("Buy 'Go Global'..."), keeping the existing "always show the
  roadmap, never fully hide what's coming" philosophy Getting Started items already use.
- Also hosts "🔄 Reset Layout."

## The "OS chrome" question

A real desktop always has *some* fixed chrome even with zero windows open — somewhere for the
Start Menu button and the most critical glanceable info (credits, at minimum) to live regardless
of what's open or closed. **Recommendation**: keep a slim, always-visible top strip (brand/logo,
OS-theme picker, credits, Start Menu button) that is *not itself a window*. The user's "status bar
is an app" ask is satisfied by the *detailed* stat readout (skill pts/tasks/streak/loot/uptime/
sanity/HP, plus the HUD footer's level/stage/stat-chips) moving into its own closable `status`
window — while the minimal strip stays put as the actual taskbar. This avoids the chicken-and-egg
problem of "how do you reopen the Start Menu if the thing hosting it is itself closed."

## Mobile

Free-dragging windows is a poor fit for touch (small screens, no natural "grab this rectangle"
affordance), and mobile already has its own stacked/scrollable layout via the existing
`@media (max-width:820px)` block. **Recommendation**: below 820px there is *no window manager at all*
— **both** the tmux-tiling era and the floating-windows era collapse to the same stacked layout, one
full-width section per **unlocked** app. The paradigm flip (and the Start Menu, drag, minimize/close)
is desktop-only. A mobile player who buys "Windows 3.1" gets the theme change but no layout change —
an accepted degrade, not a gap. Store access stays the existing `#shopBtn` slide-out drawer, so
there's no "how do I reach the Store" chicken-and-egg (no Start Menu needed on mobile).

**Consequences of the full-gate + day-1-terminal decisions for mobile (these pull work into Phase 1,
not Phase 5):**

- The current mobile CSS hardcodes panel heights per id (`#globePanel{height:64vw}`,
  `#agentsPanel{height:460px}`, …). Once apps are purchase-gated, the stack must be **driven by
  unlock state + app order**, not a fixed id list — a fresh mobile save shows *only* the terminal,
  then stacks apps in as they're bought (desktop tiling minus the tiling). So **Phase 1 must make the
  mobile stack unlock-aware**; deferring all mobile to Phase 5 would break a fresh mobile save.
- Mobile *polish* (spacing, per-era feel, confirming it reads well) stays a Phase 5/6 pass. Only the
  unlock-driven stacking is a Phase 1 must-have.

## Theming

The OS-era theme system (`:root[data-theme=...]`) reskins `.panel`/`#shop`/etc. today via long,
heavily-repeated selector lists per era — already flagged in `todo.md` as "DRY the theme CSS"
(marked risky to hand-refactor because of selector specificity). Converting panels into windows
touches every one of those selector lists anyway, so **this plan folds that DRY pass into Phase 1**
rather than doing the work twice — same reasoning as bundling the chart-helper extraction into
`crafting-update.md`'s Phase 1. Actual per-era title-bar chrome (Windows 95 raised-3D buttons, flat
DOS borders, etc.) is real polish but secondary — its own later phase, not a blocker for the
mechanism working correctly.

## Implementation architecture (Phase 1) — verified against `index.html` 2026-07-05

Concrete code-level approach, written down before the big edits so it's resumable. Keys off the
function map at [`index.html`](../index.html) (search the `=== name ===` banners).

- **`APPS` registry** — a new data-driven table (per the project's table-not-conditionals convention),
  one row per app: `{id, title, emoji, order, unlockKey}`. `unlockKey` is the `P.unlocked` field that
  gates it (`null` = always on, i.e. `terminal`). This is the single source of truth the layout
  engine iterates. Content DOM is the *existing* panels (`#globePanel`, `#chartsPanel`, the shop
  sections, etc.) — apps **re-parent** existing DOM into tiles; we do not rebuild each panel's innards.
- **`applyLayout()`** — one top-level function, called wherever `applyUnlocks()` is today. Picks the
  render mode: mobile (<820px) → unlock-filtered stacked sections; desktop + `P.up.os===0` → tmux
  tiling; desktop + `P.up.os>=1` → floating WM (**Phase 2 — stubbed to tiling for now**). It shows
  only apps whose `unlockKey` is set (or null), in `order`.
- **tmux tiling** — replace the fixed `#grid` CSS grid (`grid-template-areas`) with a container that
  lays out *only unlocked* apps. v1 = a reflowing CSS grid (count-driven: 1 app = full screen, 2 =
  split, 3–4 = quadrants…) with divider styling — gives the "panes tile in as you buy" feel with
  minimal engine code. True tmux binary-splits are a later refinement, not a Phase 1 blocker.
- **Unlock economy** — two apps reuse existing gates, five get new ones:
  - `agents` reuses **`P.up.hire >= 1`** (the existing "Hire an Agent" tier upgrade — `MULT.workers =
    1 + P.up.hire`, so a fresh save is already just the manual "you"). First agent = 60cr (existing
    `HIRE[1].cost`), which supersedes the earlier approved "agents 40". No new gate — same reuse
    principle as Upgrade OS→Win31.
  - `telemetry` (400) / `deploy_mesh`→`globe` (1400) reuse the existing `u_tele`/`u_globe` unlocks.
  - **New** `kind:"unlock"` rows in `UPG`, reusing that pattern, add five `P.unlocked` keys:
    **status 120, inventory 500, equipment 700, ide 1000, missions 1800.** Ordered by cost in the
    "Getting Started" category (always-revealed roadmap). Buying sets `P.unlocked[key]=true` →
    `applyUnlocks()`/`applyLayout()` re-tiles.
  - `store` bootstraps at ~10 credits via the existing `P.reveal.shop` threshold (it's the buy hub,
    so it can't cost credits).
- **Terminal/agents split** — `buildWorkers()` renders the manual worker (slot 0) into the `terminal`
  app and the auto workers (slots 1…n-1) into the `agents` app; the `agents` app only shows when
  `P.up.hire >= 1` (i.e. there *are* auto workers). Trickiest bit (both are one `#agentList` grid
  today) — do it early.
- **Intro replacement** — delete the `body.intro` full-screen-agents CSS hack; day-1 falls out
  naturally because `terminal` is the only unlocked app, so it's the only (full-screen) tile. Keep the
  `P.reveal` credit/Store thresholds; they now drive the always-on status strip + Store appearing.
- **State** — Phase 1 needs **no new persisted field**: tile positions are derived, not stored, so
  `P.windows` (x/y/z) is deferred to Phase 2 (floating WM). Only `P.unlocked` grows (new app keys),
  and it's already in `PERSIST`. Migration: any pre-windowing save → `unlockAll()` flips every new
  app key true, so upgraders keep everything they had.
- **Build order (each verifiable in headless Chrome before the next):** (1) unlock economy data +
  shop cards; (2) `APPS` + `applyLayout()` tmux tiling replacing `#grid`, gated on unlock; (3)
  terminal/agents split; (4) intro removal + Store bootstrap; (5) mobile stack unlock-aware; (6)
  theme-CSS DRY (most deferrable — do last, revert if it destabilizes).

## Phased delivery

Same discipline as `crafting-update.md`: each phase on its own branch, full verify pass (headless
Chrome — drag/open/close/persist/reload, not just "it compiles"), docs updated as part of "done,"
merge `--no-ff` to `main` only when the phase is genuinely finished.

### Phase 1 — App abstraction + tmux tiling layout + day-1 terminal
This phase delivers the **pre-upgrade** paradigm: a fresh save that is just a terminal, growing into
a tmux-style tiled split as apps are bought one by one. No floating windows yet.
**Status: core complete + verified on `phase1-window-manager` (2026-07-05). One item deferred (theme DRY).**
- [x] Generic "app" abstraction: `APPS` registry (`{id,panelId,order,unlocked()}`), content decoupled
      from the host layout engine (same rows will feed the Phase 2 floating WM)
- [x] tmux-style tiling layout engine: `applyLayout()` + count-driven `#grid[data-count]` CSS; day-1 =
      single full-screen terminal pane; each newly-unlocked app tiles in. (Reflowing grid, not binary
      splits — the v1 chosen in the architecture.)
- [x] **Unlock economy — the four gameplay tiles only**: terminal (always), `agents` reuses
      `P.up.hire>=1` (60cr), telemetry (400) / deploy_mesh→globe (1400) reuse the existing unlocks;
      Store bootstraps via `P.reveal.shop` (~10cr). Also generalized `buy()`'s unlock meme (data-driven
      `meme` field) as a standalone cleanup.
      **Correction (2026-07-05):** the five *additional* unlock purchases (status 120 / inventory 500 /
      equipment 700 / ide 1000 / missions 1800) were built then **reverted** — their systems aren't
      apps yet (still in the status bar / shop drawer), so the purchases would be no-ops on `main`
      (forbidden — "nothing half-finished on main"), plus forward-declaring their `P.unlocked` keys
      risked a migration trap. **Each of those gates now ships in the phase that converts its system to
      an app (Phases 2–4), with its own key + absence-grandfather migration.** The full cost/order
      design is preserved above in the architecture section.
- [x] **Terminal/agents split**: manual worker (slot 0) → `#manualWrap` in the terminal app + build log;
      auto workers (slots 1+) → `#agentList` in the agents app; agents tile appears when `hire>=1`
- [x] Purchase-one-by-one / day-1: layout-driven (terminal is the only unlocked tile on a fresh save);
      kept the `P.reveal` credit/Store thresholds; retired the `body.intro` agents-fullscreen hack
- [x] No new persisted field — tile positions derived; `P.unlocked` grew (already in `PERSIST`).
      `P.windows` deferred to Phase 2
- [x] Migration: pre-windowing saves grandfather the five new unlock keys ON; `unlockAll()` extended
- [ ] **DEFERRED to its own pass** — DRY the theme CSS selector lists. Panels kept `.panel`/`.agent`/
      `.card`, so theme selectors still match (Win95 render verified); this is now an independent,
      rework-free cleanup rather than a Phase 1 blocker. Do it before Phase 5's per-era chrome work.
- [x] **Mobile: stacked layout unlock-aware** — locked panels are `display:none` (so a fresh mobile
      save shows only the terminal); terminal heightened for the mash+log split; day-1 fills the screen
- [x] Verified end-to-end **desktop + mobile** (fresh = terminal only; mash→credits+Store reveal;
      buy Hire → agents tiles in; 4-tile persist/reload; 0 JS exceptions). Docs updated. *(Commit/push
      pending user go-ahead.)*

### Phase 2 — Windows 3.1 gate: floating window manager
This is the paradigm flip, gated on the **existing** "Upgrade OS" purchase — no new upgrade. Everything
under "Window manager mechanics" / "Start Menu" / "OS chrome" describes this **post-upgrade** state.
**Status: complete + verified on `phase2-floating-wm` (2026-07-06). Committed in three increments.**
- [x] Switch the top-level layout engine on `P.up.os >= 1` (owns Win31) on desktop: tmux tiling below,
      floating windows at/above. Keys off *owned tier* (`P.up.os`), not `P.themeChoice`. `P.windows`
      (x/y/w/h/z/open per app) added to defaults/PERSIST + seed-on-load migration; `DEFAULT_WINDOWS`
- [x] Floating window render mode: `.head` becomes the title bar (drag + inject min/close), pointer
      drag with canvas clamping, click-to-focus z-order (top window gets a cyan focus ring)
- [x] Start button lives in the existing top strip (`#statusbar`) — shown only in float mode
- [x] Start Menu (`#startMenu`): every app with open/closed state, greys out still-locked apps,
      reopens/focuses any app; hosts Reset Layout (restores `DEFAULT_WINDOWS`). Minimize == close ==
      "send to Start Menu" (identical in the Win31 era, per plan)
- [x] Verified both-way flip: buying Upgrade OS live (tmux→float) *and* prestige (float→tmux, since
      `P.up.os` resets to 0); drag/close/reopen/persist across reload; mobile stays tiling at any
      `os`; Phase 1 tiling regression re-checked at `os:0`. 0 JS exceptions across all suites.
- [x] Docs updated; committed. (Note: existing saves with level≥4 have `os≥1` via the legacy
      level→OS migration, so they open straight into floating windows — intended "you own this era".)

### Phase 3 — Convert remaining gameplay panels (both modes)
**Status: complete + verified on `phase3-status-app` (2026-07-06).**
- [x] Deploy Mesh + Telemetry lock behavior finalized: the in-panel **lockmask overlay is retired**
      (DOM + CSS + the `.locked` toggle removed) — a locked app simply isn't tiled/windowed and is
      greyed in the Start Menu, exactly as intended. (Both were already registered apps since Phase 1-2.)
- [x] **Status app** (`#statusPanel`, 📟): the detail stats (skill pts / tasks / streak / loot /
      uptime / sanity) and the whole level/stage/xp HUD + stat-chips moved out of the always-on chrome
      into their own app. The top strip is slimmed to **brand · theme picker · ⊞ Start · credits ·
      upgrades** (the "OS chrome" / taskbar). Tiles as the 3rd app; a window in float mode.
      **Gate decision (judgment call, not purchase-gated):** status is always available and appears
      the moment you graduate the intro (`unlocked: !P.intro`) — chosen over the plan's tentative
      "status 120" gate because hiding level/XP/HP behind a purchase would starve early-game feedback.
      So the five deferred *purchase* gates now number four (inventory/equipment/ide/missions), all in Phase 4.
- [x] Tiling grid extended to 5–6 tiles; mobile stack given a `#statusPanel` height. Verified both
      render modes + mobile (fresh save still hides status during intro; progressed shows 5 tiles /
      5 windows; stats still update live; 0 JS exceptions). Docs updated.

### Phase 4 — Split the shop into apps
**Reframed into two shippable chunks (2026-07-06).** The shop was a two-tab drawer (`#paneUpgrades`
Upgrades + `#paneToolbox` Toolbox). Converting *everything* at once is all-or-nothing, but the
**Upgrades tab (Store) extracts cleanly on its own** — the Store behaves like a default-open dashboard
app (used constantly, needs to be reachable during the intro to make the first purchase), so it
doesn't hit the launcher problem the *tool* apps do. Hence 4a (Store) shipped alone; 4b does the rest.

**4a — Store app — DONE + verified on `phase4-shop-apps` (2026-07-06):**
- [x] `#paneUpgrades` → a `#storePanel` app (upgrades + IPO/prestige + achievements), built by
      `buildShop` into `#storeBody`; `renderShop` split into `renderStore` (store, timer-refreshed
      whenever on screen) + the drawer path. Registered in APPS/DEFAULT_WINDOWS; gated on `P.reveal.shop`
      (tiles in at 10 credits — the immersive day-1 terminal now ends there, `:not(.reveal-shop)`).
- [x] Drawer slimmed to Toolbox-only (`🧰 TOOLBOX`), tabs/`setShopTab` removed; `#shopBtn` → opens
      the Toolbox drawer (`🧰 toolbox`). Store is a window in float mode (Start-Menu reopenable).
- [x] Verified fresh→reveal→float + full Phase 1–3 regression; 0 exceptions.

**4b — the four Toolbox tool-apps — DONE + verified on `phase4b-toolbox-apps` (2026-07-06):**
- [x] `buildToolbox` refactored to build each section into its own app panel (ids preserved so
      `renderToolbox`/`renderStashList`/`renderIdeCard`/`renderMaterials`/`renderMissionBoard` are
      unchanged): **Equipment** (`#equipPanel`), **Inventory** (roll + stash, `#inventoryPanel`),
      **The IDE** (bench + materials, `#idePanel`), **Missions** (`#missionsPanel`). Built at boot.
- [x] Four purchase gates (inventory 500 / equipment 700 / ide 1000 / missions 1800), each a
      `P.unlocked` key + defaults/`unlockAll`/absence-grandfather migration; buying tiles the app in.
- [x] **Launcher decision (resolved the design fork the simple way):** tool apps are *regular
      gated apps* — shown when unlocked, `open:true` by default (like deploy_mesh/telemetry) — so **no
      launcher redesign** was needed; the Start Menu stayed float-only. Rationale: the DOS/tiling era
      is early-game (tools cost more than Win31's 650), so a fully-unlocked tiling player is rare and
      the 4×3 tile grid handles up to 10 tiles cleanly. *Known cosmetic tradeoff:* in float mode a
      fully-unlocked save opens ~10 overlapping windows — fine (draggable/closable/Reset-Layout), but
      the default float **arrangement** wants a polish pass → Phase 5.
- [x] Drawer fully retired: `#shop`/`#shopScrim`/tabs/`toggleShop`/`shopOpen`/`#shopBtn` + the `U`
      shortcut all removed; Reset/wipe moved into the Store's footer. Store + tool apps refresh on the
      main timer. (Dead drawer *CSS* left as harmless no-match selectors — trivial future cleanup.)
- [x] Verified: content builds into all 4 panels; fresh save gates them; buying tiles one in; 10-tile
      tiling + float windows; full Phase 1–3 + 4a regression; 0 exceptions. Docs updated.

### Phase 5 — Onboarding integration & economy tuning
- [ ] Nail the purchase-one-by-one funnel end-to-end (day-1 terminal → Store → each app's unlock);
      retune the new app-unlock costs/order against real play (this is where the Phase-1 economy
      numbers get their playtest pass)
- [ ] Confirm the funnel reads well in both tmux mode (pre-Win31) and floating mode (post-Win31)
- [ ] Verify end-to-end (fresh save, every reasonable purchase order); update docs; commit + push

### Phase 6 — Theming & later-era chrome
- [ ] Per-OS-era window chrome (title bar style matching DOS/Win31/Win95/Win10/NEON/STARSHIP)
- [ ] Later-era navigation shifts (see open questions): e.g. a bottom/side **taskbar** with per-app
      icons arriving with a later OS era (GNOME/OSX-style dock), while Win31 keeps the Start Menu
- [ ] Mobile behavior pass (confirm the stacked fallback still feels right once everything's an "app")
- [ ] Optional: resizable windows; reduced-motion pass on drag/open/close
- [ ] Verify end-to-end; update docs; commit + push

## Open questions still to settle

- **THE Phase-1 blocker: app-unlock costs + order.** Full purchase-gates are in (decision above), so
  before coding Phase 1 we need the actual numbers — which app unlocks first, second, …, and what
  each costs in credits. Anchor points that already exist: Install Telemetry = 400, Go Global = 1400,
  and the Store bootstraps ~10 credits. A sane first-pass order to react to: `terminal` (free, day 1)
  → `store` (bootstrap) → `agents` → `status` → `equipment` → `inventory` → `ide` → `missions` →
  `telemetry`/`globe` (existing). Costs to be proposed and tuned in Phase 5. **This is the one thing
  still needed to start Phase 1.**
- **Prestige cosmetic perk** (user thread, 2026-07-05): prestige resets `P.up.os`→DOS and drops you
  back to tmux (accepted). Open: should *something* cosmetic survive as a prestige reward — a kept
  font, a badge, a retained theme unlock? Nice-to-have, not a blocker; slot into Phase 6 if pursued.
- Do later OS eras (Win95→Win10→NEON→STARSHIP) each shift the paradigm again (e.g. Win95 adds the
  taskbar/dock, OSX-era adds a dock) or are they pure cosmetic reskins of the same floating WM? Ties
  into the Phase 6 "later-era navigation shifts" bullet.
- ~~Does `missions` auto-open on first Sprint Config, or start open from minute one?~~ **Moot** —
  missions is now a normal purchase-gated app like the rest (full-gates decision).
- Minimize vs close — **decided (user, 2026-07-05)**: for the Win3.1 era, identical behavior — both
  land in the **Start Menu**, no separate taskbar list of minimized apps. The Start Menu *is* the
  Win3.1 relaunch affordance (period-authentic). A bottom/side **taskbar or dock with per-app icons**
  is deferred to a **later OS era** (GNOME/OSX-style), where minimized apps could get their own dock
  tiles distinct from closed ones — see Phase 6. So v1 = Start Menu only; dock is a future upgrade,
  not a v1 alternative to it.
- Does the Start Menu button live in the new minimal taskbar strip, or take over the current
  `#shopBtn` position exactly? Leaning toward the strip, since Store becomes just one app among several.
- Is resizing worth it for any app specifically (Telemetry and Inventory seem likeliest to benefit
  from more vertical room), or skip it entirely for now?

## Backlog absorbed

- `todo.md`'s **"Onboarding polish"** bullet (reveal animations, gate more stats/panels, next-unlock
  hints) → Phase 5 here.
- `todo.md`'s **"DRY the theme CSS"** → Phase 1 here.
- The triage note asking for modular/moveable/minimizable windows, a Start Menu, and a layout reset
  → this whole document.

## Feedback

(Raw notes get folded into the sections above as they come in — scratchpad for whatever's next.)

### Playtest feedback — 2026-07-06 (first live play of Phases 1–4)

**✅ Done (branch `playtest-onboarding-fixes`, not yet merged):**
- Shift-click a stat's **+** button now pours **all** skill points into that one stat.
- **One-time unlocks vanish from the Store** once bought (telemetry, etc. — no more "OWNED" clutter).
- **Fewer Store options at the start** — app-unlock cards reveal progressively (50%-saved) instead of
  all showing at once; hire/skill stay always-visible.
- **Character sheet is now a purchasable app** — "📟 Status Readout" (25cr) unlocks the Status app.
- **Store reveal button** — a pulsing "🛒 Open Store" appears at 10 credits; the Store no longer
  auto-pops-in jarringly (you click to open it the first time).
- **Autocomplete Assist now types code**, not just advances the task bar (was a real bug).

**✅ Done — batch 2 (branch `playtest-batch-2`):**
- **Notifications + flying text are now purchasable, gated, toggleable.** Day-1 is a clean terminal —
  no toasts, no flying banners. `🔔 Push Notifications` (40cr) enables toast pop-ups; `🎉 Hype Banners`
  (120cr) enables the flying meme text. Both live in the Store's "Getting Started" list. Every routine
  event still writes to the **Terminal log** regardless, so muting loses nothing permanent (this is the
  fix for toasts covering the Store in DOS — nothing pops until you opt in). Once Push Notifications is
  owned, a **🔔 Notifications** settings card appears in the Store with per-type mute toggles:
  **Grind & Loot / Level & Stage / System & Buys**, plus **Hype Banners** (once owned). Toasts carry a
  `cat` bucket (`toast(t,d,col,cat)`, default `system`); `flyMeme()` is gated on `P.up.hype` + the
  `hype` toggle. Existing saves are grandfathered ON (`hadNotify` captured before the `du` backfill).
  Also routed the previously toast-only onboarding tips / layout-reset / theme-switch lines to the
  Terminal, and fixed stale "press U" / "bottom bar" copy in the tips.

**✅ Done — batch 3 (branch `playtest-batch-3`):**
- **Character-sheet layout — skills are now a vertical section.** The Status app reads like a real
  character sheet: meta stats (skill pts / tasks / streak / loot / uptime) up top, sanity bar, then
  level+title / stage, then a **◈ Skills** header over a full-width **one-stat-per-row vertical list**
  (emoji · name · big colored value · `+` button), instead of the old cramped wrapping strip. CSS-only,
  scoped to `#statusPanel` so it applies in both tiling and floating modes; the mobile media query
  still overrides to its compact grid on tiny screens.

**🔜 Queued (not started):**
- **Telemetry rework:** stat-sheet needs **stat names**; **mouseover explainers** for failure rate,
  sanity, and each stat; **move the credits counter into Telemetry** when available (maybe make
  Telemetry a required first purchase) with a **credits-over-time line graph + credits/sec**.
- **Win 3.1 chrome:** **resizable windows**; move the **taskbar to the bottom, Start button far-left**;
  **Start Menu fly-out** currently dark/unreadable → theme it lighter; **big chunky retro scroll bars**
  (from ideas.md 📥); **items should not appear in the Start Menu** (from ideas.md 💡 — needs
  clarification: likely means only *apps* belong there).
- **Float default window arrangement** polish — a fully-unlocked save opens ~10 overlapping windows.
- **Game speed is way too fast** — economy/pacing tuning. *Explicitly deferred: keep it fast for
  now, it's good for repeat testing.*
- From ideas.md 💡 (user's space, not actioned): **"Slack" as a purchasable app** — unhinged messages
  from salespeople / PMs ("nothing from my end"), hurts productivity while open. Walk-through of the
  code. Keep the machine awake while working.
