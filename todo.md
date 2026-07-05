# vibe hacker — future ideas

A backlog of things that would make it deeper / weirder / more fun. Not committed to any of these.

## Small Wins
- [x] **🪄 Autocomplete Assist** (Hardware, repeatable, max 15 levels) — your own manual slot now
  auto-fills +5%/sec per level (capped 75%), stacking with mashing. Baseline (0 levels) is unchanged:
  verified zero progress with zero input over 2.5s; at max level, verified 20%→63% progress over 2.5s
  with zero input. Typing/tapping is still required for the last stretch even at max level.
- [x] Reset lives only at the bottom of the shop drawer (danger-zone footer, labeled **"⟲ sudo rm -r /"**
  for flavor, confirm-prompt unchanged). No reset option during the intro terminal — the shop needs
  10 credits to open, and getting there is quick enough that waiting is fine; removed the bottom-left
  corner fallback that used to cover that window.

## Themes & vibe
- [x] **Era themes, bought not leveled** — "Upgrade OS" is a Rigs-tier shop item (like New Machine/AI
  Model); buying it auto-switches your look. Click the OS name (top-left) to pick any *already-owned*
  look, independent of your max tier — persisted as `themeChoice`. Old saves grandfather in whatever
  era their level used to imply, so nobody regresses. Resets to DOS on prestige, like the rest of the rig.
- [ ] Per-era **sound**: DOS beeps, the Windows 95 startup chime, modern UI blips (mute toggle).
- [ ] Era-appropriate fonts embedded (currently system fonts).
- [ ] CRT curvature / boot sequence animation when the OS "upgrades".
- [ ] Seasonal / time-of-day palettes.

## Gameplay depth
*(Stat synergies/set bonuses and milestone bosses were absorbed into [crafting update.md](crafting%20update.md)
Phase 7 — done: a stacking set bonus for 2+ Custom-Built+ equipped items, and level/OS-tier gates
on the Cooling and Neural Interface slots + item-level ceiling.)*
- [x] **Progressive onboarding** — start as one manual terminal + one stat; unlock agents, panels, and
  skills step by step (ghosted panels show the potential). Old saves migrate to fully-unlocked.
- [x] **Intro funnel** — fresh start is a full-screen terminal that only advances on keypress/tap
  (pure hackertyper); first filled bar reveals the credits counter, 10 credits reveals the shop button,
  first purchase graduates into the full cockpit. Mid-intro saves resume correctly; old saves skip it.
- [x] **Prestige layer** — "IPO / Cash Out" banks **Equity** for a permanent +2%/pt XP & credit multiplier.
- [x] **Achievements** — 21 achievements with live unlock toasts + completion % in the shop.
- [x] **Achievements stay hidden until close** — progress-based ones (task counts, levels, streaks)
  reveal at 75% of the way there; single-trigger ones (Critical Hit, burnout, first IPO) stay hidden
  until the instant they're earned. "Hello, World" is always visible.
- [x] **Shop items reveal at 50%-saved** — Hardware/Rigs/Automation cards (and their category headers)
  stay hidden until your peak-ever credits reach half the price; owned items always stay visible; peak
  resets on prestige. "Getting Started" items and the IPO card are exempt (always the visible roadmap).
- [ ] **Onboarding polish** — retune early credit pacing once there's playtest data. (Reveal
  animations / gating more panels progressively is now [window manager.md](window%20manager.md)
  Phase 4, since the windowing system solves that architecturally instead of cosmetically.)
- [ ] **Make saving itself an early upgrade** — a cheap "Getting Started" item (e.g. "💾 Enable Auto-Save" /
  "🗄️ git init") that gates persistence: before buying it, progress doesn't survive a reload/close (session
  only, no cookie/localStorage write); buying it is the moment your run becomes durable. Thematic (early-career
  dev who hasn't set up backups yet) and fits "everything is earned via purchase." Needs care: risk of real
  frustration if someone plays a while pre-purchase and loses it — maybe make it near-free and/or nudge hard
  toward buying it first; decide whether achievements/lifetime stats persist independently of this gate.
- [ ] **Random events / incidents** — prod outage, viral launch, layoffs, hackathon — timed choices with risk/reward.
- [ ] **Tech tree** for one-time perks (e.g. "Pair Programming", "TDD", "Rubber-duck Mastery").
- [ ] Agent **personalities / specializations** (each agent better at certain stats).
- [ ] **Buffs/debuffs** with durations (crunch mode, weekend, coffee crash).
- [ ] Difficulty / challenge modes (ironman: no burnout recovery).

## Economy / math
*(Networking is now the Modem hardware slot, and Bulk-buy is now part of the Toolbox — both in
[crafting update.md](crafting%20update.md) Phase 3/4 — instead of tracked separately here.)*
- [ ] Rebalance curves once there's playtest data; add a "credits/sec" and "XP/sec" readout.
- [ ] More upgrade branches (second office, cloud credits, interns).
- [ ] Soft/hard caps + prestige resets so numbers stay meaningful.
- [ ] Offline progress summary screen (what happened while away).

## UI / polish
- [ ] Number formatting options (scientific notation past a threshold).
- [ ] Settings panel (reduce motion, mute, number format, theme lock).
- [ ] Stats/graphs page: lifetime totals, best streak, time per stage.
- [ ] Keyboard shortcuts help overlay.
- [ ] Save import/export (copy a string) + multiple save slots.
- [ ] Better mobile shop ergonomics (sticky buy bar).

## Tech
- [ ] Split the single file into modules + a tiny build step (keep a bundled single-file output).
      Revisit ~2,500–3,000 lines, or when we want tests/reuse. Do the chart-helper extraction below
      then (theme CSS dedup already has a home — see the window-manager line just below).
- [x] ~~DRY the theme CSS~~ — moved to [window manager.md](window%20manager.md) Phase 1: converting
      panels into windows touches every one of these selector lists anyway, so it's bundled in there
      instead of being a separate pass.
- [ ] **Extract a chart-draw helper** — drawLine/drawBar/drawSpark/drawGauge each still repeat the
      same `$(id)` → `fitCanvas()` → `clearRect()` one-liner. Small, low-value on its own; bundle
      it in whenever these functions are touched for something else anyway.
- [x] ~~Wire up or drop write-only state~~ — `P.loc`/`P.deploys`/`P.bugsFixed` become crafting
      material sources in [crafting update.md](crafting%20update.md) (Phase 5), no longer dead trackers.
- [ ] Move save to IndexedDB (bigger, structured) while keeping the cookie/localStorage fallback.
- [ ] Real offline via a service worker (installable PWA).
- [ ] Unit tests for the economy math (success/credit/cost formulas).
- [ ] Reduced-motion + accessibility pass (contrast, focus states, ARIA on shop).

## Silly / stretch
- [ ] Leaderboard (opt-in) of levels / net worth.
- [ ] "AI co-founder" that occasionally gives cursed advice.
- [ ] Konami code easter egg.
- [ ] Export your career as a shareable "resume" card image.