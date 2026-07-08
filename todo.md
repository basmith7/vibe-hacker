# vibe hacker — future ideas

A backlog of things that would make it deeper / weirder / more fun. Not committed to any of these.

**Priority tags** — open items carry `[W#·S/M/L]`: **W#** = suggested wave (tackle order, driven by
dependencies, not raw desire — lower first), **S/M/L** = rough effort. Waves: **W1** quick wins ·
**W2** Settings hub · **W3** taskbar/title-bar merge (tracked in [window-manager.md](docs/window-manager.md)) ·
**W4** "everything's a purchase" · **W5** economy & pacing pass · **W6** vibe & theming · **W7** new
gameplay systems · **W8** data & platform · `stretch` = whenever · `fork` = a philosophy call, not
scheduled work. (Game speed is wanted sooner but sequenced in W5 — sequence ≠ desire.)

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
- [ ] **[W6·M]** Per-era **sound**: DOS beeps, the Windows 95 startup chime, modern UI blips (mute toggle).
- [ ] **[W6·M]** Era-appropriate fonts embedded (currently system fonts).
- [ ] **[W6·M]** CRT curvature / boot sequence animation when the OS "upgrades".
- [x] **[W1·S]** Seasonal / time-of-day palettes — `#ambient` overlay (`ambientTint()`, drifts every
      5 min) washes a subtle time-of-day sky glow (top) + seasonal horizon glow (bottom) over the
      cockpit. `screen` blend so it reads on the dark themes without hazing center content; layers on
      top of any OS look. *(A future Settings toggle — W2 — could gate it.)*

## Gameplay depth
*(Stat synergies/set bonuses and milestone bosses were absorbed into [crafting-update.md](docs/crafting-update.md)
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
- [ ] **[W5·M]** **Onboarding polish** — retune early credit pacing once there's playtest data. (Reveal
  animations / gating more panels progressively is now [window-manager.md](docs/window-manager.md)
  Phase 5, since the windowing system solves that architecturally instead of cosmetically.)
- [ ] **[W4·M]** **Make saving itself an early upgrade** — a cheap "Getting Started" item (e.g. "💾 Enable Auto-Save" /
  "🗄️ git init") that gates persistence: before buying it, progress doesn't survive a reload/close (session
  only, no cookie/localStorage write); buying it is the moment your run becomes durable. Thematic (early-career
  dev who hasn't set up backups yet) and fits "everything is earned via purchase." Needs care: risk of real
  frustration if someone plays a while pre-purchase and loses it — maybe make it near-free and/or nudge hard
  toward buying it first; decide whether achievements/lifetime stats persist independently of this gate.
- [ ] **[W4·M]** **Retire Espresso Machine + Autocomplete Assist as shop upgrades; move them onto gear** (routed
      from `ideas.md` 📥). Drop the two repeatable Hardware upgrades (`coffee` = +max sanity/regen,
      `assist` = passive auto-typing) and re-express their effects as **stats or equipment patches/mods**
      — e.g. a sanity-regen patch and an auto-type patch on hardware slots, so those powers come from
      loot/crafting rather than a flat buy. Needs a migration for saves that own levels in either
      upgrade (refund credits, or grant an equivalent starter patch), plus fitting them into the
      existing `PATCH_DEFS` roll pool without warping drop odds.
- [ ] **[W4·M]** **Achievements as a purchasable app with retroactive unlock** (routed from `ideas.md` 📥). Make
      Achievements its own bought app (like the other apps). Until purchased, achievements **don't fire
      at all**; the moment you buy the app, **retroactively grant every achievement already earned, all
      at once** (silent bulk-grant, no toast spam), then track live from there. Fits "everything is
      earned via purchase." Decide where the checklist lives once it's an app of its own (today it's a
      section at the bottom of the Store).
- [ ] **[W7·L]** **Random events / incidents** — prod outage, viral launch, layoffs, hackathon — timed choices with risk/reward.
- [ ] **[W7·L]** **Tech tree** for one-time perks (e.g. "Pair Programming", "TDD", "Rubber-duck Mastery").
- [ ] **[W7·L]** Agent **personalities / specializations** (each agent better at certain stats).
- [ ] **[W7·M]** **Buffs/debuffs** with durations (crunch mode, weekend, coffee crash).
- [ ] **[W7·M]** Difficulty / challenge modes (ironman: no burnout recovery).

## Economy / math
*(Networking is now the Modem hardware slot, and Bulk-buy is now part of the Toolbox — both in
[crafting-update.md](docs/crafting-update.md) Phase 3/4 — instead of tracked separately here.)*
- [ ] **[W5·L]** Rebalance curves once there's playtest data; add a "credits/sec" and "XP/sec" readout.
      *(credits/sec already shipped in the telemetry batch — only the XP/sec readout + the rebalance remain.)*
- [ ] **[W7·M]** More upgrade branches (second office, cloud credits, interns).
- [ ] **[W5·M]** Soft/hard caps + prestige resets so numbers stay meaningful.
- [x] **[W1·M]** Offline progress summary screen — returning with Cloud Sync gains now pops a
      "🌙 Welcome back" modal (time away · credits earned · effective rate · efficiency · balance)
      instead of a toast. Factored the help overlay into shared `.modalScrim`/`.modalCard` classes
      (themed per OS look) and reused them here; Esc/scrim/Continue dismiss, grinding suppressed while open.

## UI / polish
- [ ] **[W4·L]** **"Notification Center" — unify all three feeds into one purchasable system.** Right now the
      terminal build/CI/git log (the scrolling text under the Terminal — `#termBody`/`termLine`, e.g.
      "→ started ‹Write a for-loop›", "completed mission: Algorithm Grind (+1 commit)") is separate
      from toasts and fly-out meme text. The vision: fold the terminal log **together with** toasts and
      fly-out text into one "Notification Center" you buy as a single upgrade — the log itself becomes
      part of the notification system, not a permanently-on panel. Then a **separate** purchase unlocks
      **filtering notifications by type**. Note this reframes what shipped in playtest-batch-2 (which
      split it into `🔔 Push Notifications` + `🎉 Hype Banners` with *free* per-type toggles in the
      Store): the new direction is one umbrella "Notification Center" purchase, with type-filtering
      pulled out as its own paid upgrade rather than a free setting. Decide how the terminal log's
      always-on status reconciles with being gated (it's currently the day-1 immersive surface).
- [x] **[W2·S]** Number formatting options — Settings → Number format: `1.2K` / `1,234` / `1.2e6`
      (scientific past a million). `money()` honors `P.settings.numFormat`.
- [x] **[W2·M]** Settings panel — ⚙ button opens a themed modal (reuses `.modalCard`) with segmented
      controls for number format, reduce motion (System/Off/On), ambient tint, and OS-look lock
      (blocks the Auto-Buyer from switching themes). Persisted in `P.settings`; `applySettings()` applies.
      *(Mute deferred to W6 when sound lands — nothing to mute yet.)*
- [ ] **[W8·M]** Stats/graphs page: lifetime totals, best streak, time per stage.
- [x] **[W1·S]** Keyboard shortcuts help overlay — `?` (or a **?** button in the top strip) toggles a
      themed modal listing every control (grind, shift-click-all-SP, T, F11, Esc boss key, Start/drag/
      resize). Esc / scrim / Close dismiss it; grinding is suppressed while it's open. Themed per OS look.
- [ ] **[W8·M]** Save import/export (copy a string) + multiple save slots.
- [ ] **[W8·M]** Better mobile shop ergonomics (sticky buy bar).

## Tech
- [ ] **[fork·L]** Split the single file into modules + a tiny build step (keep a bundled single-file output).
      Revisit ~2,500–3,000 lines, or when we want tests/reuse. Do the chart-helper extraction below
      then (theme CSS dedup already has a home — see the window-manager line just below).
- [x] ~~DRY the theme CSS~~ — moved to [window-manager.md](docs/window-manager.md) Phase 1: converting
      panels into windows touches every one of these selector lists anyway, so it's bundled in there
      instead of being a separate pass.
- [x] **[W1·S]** **Extract a chart-draw helper** — added `chartCtx(id)` (resolve canvas → `fitCanvas`
      → cleared ctx); drawLine/drawSpark/drawGauge now call it instead of repeating the 3-part one-liner.
      Globe/matrix left alone (they clear differently). Verified charts still render, zero exceptions.
- [x] ~~Wire up or drop write-only state~~ — `P.loc`/`P.deploys`/`P.bugsFixed` become crafting
      material sources in [crafting-update.md](docs/crafting-update.md) (Phase 5), no longer dead trackers.
- [ ] **[W8·M]** Move save to IndexedDB (bigger, structured) while keeping the cookie/localStorage fallback.
- [ ] **[W8·L]** Real offline via a service worker (installable PWA).
- [ ] **[W5·M]** Unit tests for the economy math (success/credit/cost formulas).
- [ ] **[W2·M]** Reduced-motion + accessibility pass (contrast, focus states, ARIA on shop).
      *(Reduce-motion toggle already shipped with the Settings panel — matrix off, banners/flash skipped,
      anims near-zeroed. Remaining: keyboard focus states, ARIA roles/labels, and a contrast audit.)*

## Silly / stretch
- [ ] **[stretch·L]** Leaderboard (opt-in) of levels / net worth.
- [ ] **[stretch·S]** "AI co-founder" that occasionally gives cursed advice.
- [ ] **[stretch·S]** Konami code easter egg.
- [ ] **[stretch·M]** Export your career as a shareable "resume" card image.