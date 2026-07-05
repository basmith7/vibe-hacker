# vibe hacker — future ideas

A backlog of things that would make it deeper / weirder / more fun. Not committed to any of these.

## Themes & vibe
- [x] **Era themes that evolve with level** — MS-DOS → Windows 3.1 → Windows 95 → Windows 10 → NEON//OS → STARSHIP OS.
- [ ] Manual theme picker (not just auto), remember choice.
- [ ] Per-era **sound**: DOS beeps, the Windows 95 startup chime, modern UI blips (mute toggle).
- [ ] Era-appropriate fonts embedded (currently system fonts).
- [ ] CRT curvature / boot sequence animation when the OS "upgrades".
- [ ] Seasonal / time-of-day palettes.

## Gameplay depth
- [x] **Progressive onboarding** — start as one manual terminal + one stat; unlock agents, panels, and
  skills step by step (ghosted panels show the potential). Old saves migrate to fully-unlocked.
- [x] **Intro funnel** — fresh start is a full-screen terminal that only advances on keypress/tap
  (pure hackertyper); first filled bar reveals the credits counter, 10 credits reveals the shop button,
  first purchase graduates into the full cockpit. Mid-intro saves resume correctly; old saves skip it.
- [x] **Prestige layer** — "IPO / Cash Out" banks **Equity** for a permanent +2%/pt XP & credit multiplier.
- [x] **Achievements** — 21 achievements with live unlock toasts + completion % in the shop.
- [ ] **Onboarding polish** — reveal animations beyond the fade-in, a "next unlock" progress hint once
  past the intro, gate more stats/panels, retune early credit pacing once there's playtest data.
- [ ] **Random events / incidents** — prod outage, viral launch, layoffs, hackathon — timed choices with risk/reward.
- [ ] **Tech tree** for one-time perks (e.g. "Pair Programming", "TDD", "Rubber-duck Mastery").
- [ ] Stat **synergies / set bonuses** (e.g. high Focus + high Caffeine → "flow state" buff).
- [ ] **Milestone bosses** per stage (a big timed task that gates progression).
- [ ] Agent **personalities / specializations** (each agent better at certain stats).
- [ ] **Buffs/debuffs** with durations (crunch mode, weekend, coffee crash).
- [ ] Difficulty / challenge modes (ironman: no burnout recovery).

## Economy / math
- [ ] Rebalance curves once there's playtest data; add a "credits/sec" and "XP/sec" readout.
- [ ] More upgrade branches (networking, second office, cloud credits, interns).
- [ ] **Bulk-buy** (x1 / x10 / max) in the shop.
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
      Revisit ~2,500–3,000 lines, or when we want tests/reuse. Do CSS-dedup + chart-helper below then.
- [ ] **DRY the theme CSS** — the win31/win95 (and other) `:root[data-theme=...]` surface-selector lists
      repeat heavily. Clean once there's a preprocessor/build (risky to hand-refactor: specificity).
- [ ] **Extract a chart-draw helper** — drawLine/drawBar/drawSpark/drawGauge share fit/clear/grid boilerplate.
- [ ] **Wire up or drop write-only state** — `P.loc`, `P.deploys`, `P.bugsFixed` are tracked but unused;
      turn them into achievements ("deploy 100×", "squash 500 bugs", "1M LOC shipped") or remove.
- [ ] Move save to IndexedDB (bigger, structured) while keeping the cookie/localStorage fallback.
- [ ] Real offline via a service worker (installable PWA).
- [ ] Unit tests for the economy math (success/credit/cost formulas).
- [ ] Reduced-motion + accessibility pass (contrast, focus states, ARIA on shop).

## Silly / stretch
- [ ] Leaderboard (opt-in) of levels / net worth.
- [ ] "AI co-founder" that occasionally gives cursed advice.
- [ ] Konami code easter egg.
- [ ] Export your career as a shareable "resume" card image.
