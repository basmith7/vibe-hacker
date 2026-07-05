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

**Planning — no code written yet.** This is the first draft of the phased delivery below; expect
it to get revised as design questions below get settled and as each phase surfaces things the plan
didn't anticipate (this is exactly what happened across `crafting update.md`'s 7 phases — treat
this doc the same way: a living, resumable record, checkboxes as source of truth for where to pick
back up, not a spec frozen at t=0).

## What becomes a window ("app")

| App id | Title | Replaces / wraps | Unlock condition | Default state, new save |
|---|---|---|---|---|
| `agents` | 🤖 Agent Swarm | current `#agentsPanel` | always available | open (first thing a new player sees) |
| `terminal` | 💻 Build · CI · Git | current `#terminalPanel` | always available | open |
| `status` | 📟 Status | detailed stats from `#statusbar` + `#hud` (level/stage/stat chips) | always available | open |
| `store` | 🛒 Store | current shop "Upgrades" tab | always available | open |
| `deploy_mesh` | 🌐 Deploy Mesh | current `#globePanel` | Go Global purchase (existing gate) | closed until unlocked |
| `telemetry` | 📊 Telemetry | current `#chartsPanel` | Install Telemetry purchase (existing gate) | closed until unlocked |
| `equipment` | 🔧 Equipment | current "Equipped Hardware" section | always available, harmless if empty | closed; auto-opens on your first Hardware drop |
| `inventory` | 🧰 Inventory | current Toolbox stash + Roll-for-Hardware | always available | closed; same auto-open trigger as Equipment |
| `ide` | 🛠 The IDE | current IDE + crafting-materials section | always available | closed; auto-opens on your first material drop |
| `missions` | 📋 Missions | current Mission Board | always available (board bootstraps at game start) | closed by default — see open questions |

"Auto-open the first time X happens" gives new players a one-time, event-driven introduction to
each app, which is a better fit than inventing an artificial purchase-gate for the four apps that
don't currently have one (Equipment/Inventory/IDE/Missions all became foundational, always-on
systems over the course of the crafting update, with no dedicated "buy this to unlock" item).

## Window manager mechanics

- Each window: title bar (icon + title + minimize + close buttons), draggable via title-bar
  pointer-down + move, brought to front (z-order) and visually focused on click.
- **Minimize vs close** (leaning toward, not finalized — see open questions): for v1, treat them as
  the same action — the window disappears and is only reachable again via the Start Menu. The user
  asked for "dragged and minimized" plus "a start menu to open any closed windows," which doesn't
  necessarily require a separate taskbar list of minimized apps distinct from closed ones.
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
`@media (max-width:820px)` block. **Recommendation**: mobile keeps that behavior essentially as-is
— every unlocked app renders as a stacked, non-draggable, non-closable section in a fixed sensible
order — and the desktop window manager only activates above that breakpoint. Revisit if it feels
wrong once there's something to actually try.

## Theming

The OS-era theme system (`:root[data-theme=...]`) reskins `.panel`/`#shop`/etc. today via long,
heavily-repeated selector lists per era — already flagged in `todo.md` as "DRY the theme CSS"
(marked risky to hand-refactor because of selector specificity). Converting panels into windows
touches every one of those selector lists anyway, so **this plan folds that DRY pass into Phase 1**
rather than doing the work twice — same reasoning as bundling the chart-helper extraction into
`crafting update.md`'s Phase 1. Actual per-era title-bar chrome (Windows 95 raised-3D buttons, flat
DOS borders, etc.) is real polish but secondary — its own later phase, not a blocker for the
mechanism working correctly.

## Phased delivery

Same discipline as `crafting update.md`: each phase on its own branch, full verify pass (headless
Chrome — drag/open/close/persist/reload, not just "it compiles"), docs updated as part of "done,"
merge `--no-ff` to `main` only when the phase is genuinely finished.

### Phase 1 — Window manager core + CSS DRY pass
- [ ] Generic window abstraction: mount point, title bar (icon/title/minimize/close), drag, focus/z-order
- [ ] `P.windows` state + `DEFAULT_LAYOUT` + persistence via the existing defaults()/PERSIST/loadState() pattern
- [ ] Migration: seed `P.windows` on first load of a pre-windowing save, respecting existing unlock state
- [ ] Minimal always-on taskbar strip (brand, theme-picker, credits, Start Menu button) — the "OS chrome"
- [ ] DRY the theme CSS selector lists while every window-related class is being touched anyway
- [ ] Pilot conversion: wrap Agent Swarm + Terminal (the two panels with no existing lock state) as
      real windows first, to prove drag/minimize/close/restore/persist end-to-end before rolling out further
- [ ] Verify end-to-end; update `guide.md`/`README.md`/`todo.md`; commit + push

### Phase 2 — Convert remaining gameplay panels
- [ ] Deploy Mesh + Telemetry become windows, preserving their existing purchase-gated lock
      behavior (now "not openable / grayed in Start Menu" instead of an in-panel lockmask overlay)
- [ ] Status window (statusbar detail stats + HUD level/stage/stat-chips)
- [ ] Verify end-to-end; update docs; commit + push

### Phase 3 — Split the shop into app windows
- [ ] Store window (current Upgrades tab content)
- [ ] Equipment window (Equipped Hardware section, incl. the set-bonus header)
- [ ] Inventory window (Toolbox stash + Roll-for-Hardware)
- [ ] IDE window (crafting bench + materials)
- [ ] Missions window (mission board)
- [ ] Retire the old `#shop` two-tab aside once every piece has a new home
- [ ] Verify end-to-end; update docs; commit + push

### Phase 4 — Onboarding integration
- [ ] Decide + implement each app's default open/closed state for a new save, and the "first-earned"
      auto-open trigger for Equipment/Inventory/IDE/Missions
- [ ] Rework the intro funnel around windows instead of the current `body.intro` CSS switch —
      day-1 becomes "Agent Swarm window open, nothing else in the Start Menu yet"
- [ ] Verify end-to-end (fresh save, every reasonable purchase order); update docs; commit + push

### Phase 5 — Theming & polish
- [ ] Per-OS-era window chrome (title bar style matching DOS/Win31/Win95/Win10/NEON/STARSHIP)
- [ ] Mobile behavior pass (confirm the stacked fallback still feels right once everything's a "window")
- [ ] Optional: resizable windows; reduced-motion pass on drag/open/close
- [ ] Verify end-to-end; update docs; commit + push

## Open questions still to settle

- Does `missions` auto-open on the first Sprint Config earned, or just start open from minute one
  (it's foundational to the crafting loop, arguably as core as Store/Agents)?
- Minimize vs close, for real: identical behavior (both land in the Start Menu, no separate taskbar
  list) is the v1 assumption above — confirm before Phase 1, since it affects the window abstraction's shape.
- Does the Start Menu button live in the new minimal taskbar strip, or take over the current
  `#shopBtn` position exactly? Leaning toward the strip, since Store becomes just one app among several.
- Is resizing worth it for any app specifically (Telemetry and Inventory seem likeliest to benefit
  from more vertical room), or skip it entirely for now?

## Backlog absorbed

- `todo.md`'s **"Onboarding polish"** bullet (reveal animations, gate more stats/panels, next-unlock
  hints) → Phase 4 here.
- `todo.md`'s **"DRY the theme CSS"** → Phase 1 here.
- The triage note asking for modular/moveable/minimizable windows, a Start Menu, and a layout reset
  → this whole document.

## Feedback

(Raw notes get folded into the sections above as they come in — scratchpad for whatever's next.)
