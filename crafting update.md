# Crafting Expansion — Design Plan

A Path-of-Exile-style itemization layer bolted onto the existing career sim: instead of flat
"buy Lv N of RAM" purchases, RAM/CPU/GPU/etc. become **equipped hardware** with **rollable
patches** (affixes), fed by **crafting materials** earned from specific task types, with
**missions** as a way to aim that RNG instead of just hoping.

This replaces the current repeatable Hardware upgrades (RAM/CPU/SSD/Monitor/Coffee/GPU) and the
random-flavor Loot system. **Rigs** (Machine/Model/OS tiers) and **Automation** stay exactly as
they are — this only touches the Hardware layer.

## Status

**Phases 1-4 are done.** Next up: **Phase 5 — Patches + crafting materials.** Phase 4 added a
real 🧰 Toolbox (card-list stash, filterable by slot/rarity), gambling for random hardware
(×1/×10), Decommission, and a dedicated 🛠 IDE staging slot — on branch `phase4-toolbox`, verified
end-to-end, merged to `main`. It also changed Phase 3's auto-equip-if-better rule: a full slot now
sends new drops to the Toolbox instead of silently comparing and discarding, since that's what
makes "stockpile and choose" meaningful. Phase 5 is where the itemization actually gets interesting
— patches/affixes, rarity tiers (the Toolbox's rarity filter has been sitting ready since Phase 4),
and the crafting materials that make the IDE's staging slot do something. See the checklist in
"Phased delivery" below for exact sub-step progress — that list is the source of truth for where to
pick back up. Each phase works on its own branch, gets the full verify pass, updates
`guide.md`/`todo.md`, then merges to `main` before the next phase starts (see the note at the end
of "Phased delivery").

## Stats: 9 → 5

Trimmed by merging related pairs, not by deleting flavor:

| New stat | Absorbs | Notes |
|---|---|---|
| ⌨️ **Coding** | Coding + Git-Fu | implementation work, broadly |
| 🧠 **Focus** | Focus | unchanged — still the one that speeds every task |
| 🐛 **Debugging** | Debugging | unchanged |
| 🏛 **Systems** | Architect + DevOps | big-picture design + shipping/infra |
| 🧮 **Algorithms** | Algorithms | unchanged |

**Rizz** and **Caffeine** are retired as *active* stats — no task pool, no skill point, no HUD
chip. Their effects survive purely as **patches gear can roll**: a "Rizz" patch still reduces
failure damage, a "Caffeine" patch still speeds Sanity regen. You get them from equipping the
right gear instead of grinding a task pool for them. This is the cleanest way to trim 9→5 without
actually deleting either stat's identity.

**Migration:** an existing save's old Rizz/Caffeine values convert into a small number of
starter patches on random equipped slots (so nobody's investment just evaporates); old
Coding+Git-Fu and Architect+DevOps values get summed/scaled into the merged stat.

## Player level: 1–100

- Retune the XP curve so 100 is a real, hard-fought milestone — not reachable in one sitting.
- The existing 20 titles get re-spaced across the full 1–100 range (every 5 levels instead of
  every 3) — no new titles needed, just wider spacing.
- Leveling technically continues past 100 (no hard cap), but the curve keeps steepening — 100 is
  a soft narrative ceiling, not a wall.
- OS eras (MS-DOS → STARSHIP OS) stay purchase-gated, not level-gated — already decoupled from
  level in the current design, so no change needed there.

## Hardware slots

| Slot | Governs (slot-specific patch pool) |
|---|---|
| 🧠 RAM | Task speed |
| ⚙️ CPU | XP gain |
| 💾 Hard Drive / Storage | Credit multiplier (absorbs the old SSD effect) |
| 🖥️ Monitor | Passive credits/sec |
| 🎮 GPU | Crit chance / crit multiplier |
| 📡 Modem *(new)* | Task failure-chance reduction, offline-earning efficiency |
| ❄️ Cooling *(maybe, later)* | Sanity/burnout-adjacent effects |
| 🧠 Neural Interface *(endgame, maybe)* | Big multi-stat patch pool — gated to the STARSHIP OS era |

Coffee's old Sanity effect has no obvious slot, so it stays a **generic patch** rollable on any
slot (alongside flat +stat rolls and the old Rizz failure-damage-reduction effect).

**Autocomplete Assist** stays a standalone repeatable purchase, *not* part of the slot/patch
system — automating your own typing doesn't fit "damage roll on gear" cleanly.

Each slot holds one equipped item. Empty = the old "Lv 0" baseline (no bonus). Items are gated by
a minimum player level to equip, so a lucky early drop can't be slotted in day one.

### Retro hardware naming

Base items (the "Stock" tier, before any patches) get names that mimic real-world hardware,
starting in the '80s and moving forward — playful, not accurate (an "Orange II" doesn't need to
make sense as a specific slot type). This should ride the **same 6-era timeline the OS tiers
already use**, so your whole rig visibly ages together instead of just the wallpaper:

| Era (matches OS_TIERS) | Example base-item flavor (any slot) |
|---|---|
| MS-DOS | "Orange II," "Trash-80," "IBM PC/XT clone" |
| Windows 3.1 | "386SX Turbo," "Packard Smell" |
| Windows 95 | "Pentium Overdrive," "SoundBlaster-compatible" |
| Windows 10 | "ThinkPad-alike," "GeForce (bootleg)" |
| NEON//OS | "Quantum-something," near-future consumer tech |
| STARSHIP OS | fully sci-fi, no real-world referent needed |

Exact per-slot name lists are a content-authoring pass, not a design decision — sketch a handful
now, fill the rest in once the slot/patch system exists to hang them on.

## Patches (affixes)

- Up to **4 patches** per item.
- **Slot-specific** pool (the table above) + a **generic** pool usable on any slot:
  flat +stat (any of the 5), Sanity max/regen (old Caffeine), failure-damage reduction (old Rizz).
- Each patch line has **tiers**; better tiers have **lower roll weight** (rare) and are **gated
  by the item's Build Version (ilvl)** — a low-ilvl item literally cannot roll the top tier.
- Item level is set at drop time, roughly tied to your current stage/player level (like a
  monster-level→item-level relationship).
- **Patches are earned as drops only** — never directly purchasable with credits. Credits stay
  relevant a different way: every crafting action (see below) consumes a *small amount of
  credits* in addition to its material, so the core economy doesn't go dead at endgame.

## Crafting materials

Certain task types drop materials instead of (well, in addition to) credits — tied to the merged
stats plus the currently-dead `P.loc` / `P.deploys` / `P.bugsFixed` counters, finally put to use.
Every craft below also costs a small amount of credits on top of the material.

| Material | Dropped by | Does |
|---|---|---|
| **Commit** | any task (baseline, common) | Add a random patch to an item with open slots |
| **Hotfix** | Debugging tasks (`P.bugsFixed`) | Reroll one patch's *value* (same mod, new number) |
| **Refactor Token** | Systems tasks (`P.deploys`) | Reroll one patch's *type* entirely |
| **Full Rewrite** | rare, any task (`P.loc` milestones) | Reroll *all* patches on an item |
| **Revert Commit** | rare | Strip an item back to Stock (no patches) |
| **Feature Branch Merge** | rare, late-game | Add a patch slot beyond the item's current count (up to 4) |

Also earnable by **Decommissioning** unwanted gear (see Inventory, below) — sacrifice an item you
don't want for a small material/credit refund instead of it just taking up space.

### Material progress meters

Each material gets a counter (how many you have) **plus a slim progress bar underneath it that
fills toward the next unit** — a visible soft-pity meter. Actions that *could* drop that material
nudge the bar even on attempts that don't drop one; a full bar either guarantees or heavily
favors the next qualifying task producing one. This keeps individual rolls feeling random while
making the grind toward a specific material legible and non-frustrating (rather than a silent
die-roll every time with no sense of progress).

## Missions — aiming the RNG, and craftable themselves

Pure random material drops are frustrating once you're hunting one specific thing, so add
**Missions**: short, player-selectable contracts that bias what you earn instead of leaving it
fully random.

- Pick a mission from a small rotating board (e.g. 3 active choices): **"Debugging Sprint"**
  (next N tasks are Debugging-weighted and drop bonus Hotfixes), **"Deploy Week"** (Systems tasks
  favored, bonus Refactor Tokens), **"Hackathon"** (all task types, bonus flat Commits, shorter
  duration, higher intensity).
- Missions run for a fixed number of tasks or a time window, then complete.
- **Missions are craftable too** — the direct analogue of PoE's map mods. Spend a mission-specific
  currency to add/reroll mods *on a mission itself* before starting it, making it harder and
  proportionally more rewarding (bigger material payout, better odds at rare materials). This
  gives a second crafting loop layered on top of the gear one, using the same core verbs
  (add/reroll) applied to a different kind of target.
- **Board refresh:** completing every active mission naturally refreshes the board. Rerolling
  early (before finishing everything) costs more the more uncompleted missions you'd be
  discarding and the higher their level — so early, untouched rerolls are cheap, but scrapping a
  board you've already invested in isn't free.
- Natural home for this is a small panel or tab inside The IDE (the crafting bench), so gear
  crafting and mission management live in one place.

## Inventory & crafting workflow

A real inventory, not just instant-equip-on-drop:

- **Buy or gamble for base items.** You can acquire multiple copies of a base item (e.g. several
  CPUs) — via credits, materials, or a bit of both — stockpile them, and craft on more than one
  candidate before deciding which to equip. This is also where the existing **Bulk-buy (x1/x10/max)**
  backlog idea plugs in directly, for buying several base-item rolls at once. The existing flavor
  Loot items (Cursed USB-C Dongle, etc.) fold in here as pure junk/flavor drops — funny, but not
  real slot items, and Decommission-only (no equip value).
- **A dedicated crafting slot** in The IDE holds whatever item you're actively working on —
  separate from both your general stash and your actually-equipped gear. Craft there, then either
  equip it (promote to a real slot) or send it back to storage.
- **Decommission** (disenchant) unwanted items into a small amount of credits and/or materials, so
  duplicates and dead-end rolls aren't just clutter.
- **Missions can reward items directly**, not just materials — a guaranteed or bonus base-item
  drop as part of a mission's payout.
- **Spatial "inventory Tetris" (grid, item shapes/sizes) — recommendation: skip it.** This game's
  pacing is idle/incremental — people glance at it and let it run — and a real-time packing puzzle
  fights that pacing hard (it demands focused attention a genre like this generally isn't asking
  for). A simple **list/card view** (reusing the same card pattern the shop already uses:
  icon + name + stats + action button, filterable by slot and rarity) gets the "manage multiple
  candidates" feeling without turning inventory management into its own chore. Open to revisiting
  this once there's an actual prototype to look at and feel out — it's a real aesthetic call, not
  just a mechanical one.

## In-universe vocabulary (PoE concept → themed name)

| PoE concept | This game |
|---|---|
| Item / equipment | **Hardware** |
| Affix / mod | **Patch** |
| Rarity: Normal → Magic → Rare | **Stock → Modded → Custom-Built** |
| Rarity: Unique | **Legendary Build** (named, fixed-patch items — e.g. "The ThinkPad X1 of Legend," "Vim's Blessing") |
| Item level | **Build Version** (or "Firmware Rev") |
| Crafting bench | **The IDE** |
| Currency tab / stash | **Package Manager** |
| General item inventory | **Toolbox** |
| Orb: add random mod | **Feature Flag** |
| Orb: reroll mod value | **Hotfix** |
| Orb: reroll mod type | **Refactor Token** |
| Orb: reroll all mods | **Full Rewrite** |
| Orb: strip to normal | **Revert Commit** |
| Orb: add mod slot | **Feature Branch Merge** |
| Disenchant | **Decommission** |
| Bounty / contract | **Mission** |
| Map mod (mission difficulty/reward mods) | **Sprint Config** |

## Backlog items this absorbs

- **More upgrade branches (networking)** → the Modem slot
- **Stat synergies / set bonuses** → optional Phase 6 (2+ Custom-Built+ slots granting a bonus)
- **Milestone bosses per stage** → Phase 6 gate for unlocking new slots (Modem/Cooling/Neural
  Interface) or raising the max obtainable Build Version
- **Wire up write-only state** (`P.loc`/`P.deploys`/`P.bugsFixed`) → crafting material sources
- **Bulk-buy (x1/x10/max)** → buying/gambling multiple base-item rolls at once in the Toolbox

## Phased delivery

This is the resumable checklist — if work stops mid-phase, this section says exactly what's done
and what's next. Check items off as they land. Each phase's **last two sub-steps are always the
same**: verify end-to-end, then update `guide.md`/`todo.md` before moving on — documentation
staleness is treated as part of "done," not a follow-up.

### Phase 1 — Stat consolidation *(foundational; every later phase assumes the final 5-stat list)* ✅ DONE
- [x] Merge Coding+Git-Fu → **Coding**; merge Architect+DevOps → **Systems**; retire **Rizz** and
      **Caffeine** as active stats (no task pool/skill point/HUD chip)
- [x] Rewrite the `TASKS` pool onto the 5 surviving stats (60 tasks; old Rizz/Caffeine flavor kept
      in a code comment for reuse as Phase 5 patch flavor)
- [x] Rewire HUD stat chips, the stat-sheet chart, and the "Learn a New Skill" unlock funnel (now 5
      skills, not 9 — left the cost curve formula as-is since fewer stats already re-paces it
      sensibly; confirmed no achievement referenced an old stat id, so nothing to rewire there)
- [x] Migration: old saves' Coding+Git-Fu and Architect+DevOps values **sum** into the merged stat;
      old Rizz+Caffeine values convert into **bonus skill points** instead (`floor(leftover/10)`) —
      simpler placeholder than starter patches since patches don't exist until Phase 5, and it lets
      the player immediately reinvest via the existing `+` buttons. `unlockedStats` and `up.skill`
      remapped too. (Caught and fixed a real aliasing bug here in testing: `P.stats` and the raw
      save's `stats` object are the same reference after the generic PERSIST copy, so the old
      Rizz/Caffeine values had to be read *before* the `delete` calls, not after.)
- [x] Verify end-to-end (fresh start, migration from a pre-merge save, achievements, charts) —
      headless-driver pass, no console errors
- [x] Update `guide.md` (stats section) and `README.md`; commit + push

### Phase 2 — Level 1–100 rework ✅ DONE
- [x] Retuned the XP-curve growth from `×1.13+22` to `×1.10+18` — level 100 now lands around
      ~35M cumulative XP (a real, reachable-but-tough milestone), while 100→150 needs ~4.1B
      (brutal, matching "technically possible, very very hard" for going past 100)
- [x] Re-spaced the existing 20 titles across 1–100 (`floor((level-1)/5)`, was `floor(level/3)`) —
      verified exact title at levels 1/5/6/50/96/100/150 via injected saves, all correct
- [x] Confirmed OS eras / Prestige unaffected (both purchase-gated, untouched by the curve) — and
      while checking this, found and fixed a **real pre-existing bug**: 3 achievements ("Start Me
      Up," "Cyberpunk," "To The Stars") checked `P.level` for reaching an OS era, but OS eras have
      been purchase-gated (not level-gated) since the OS-upgrade rework — meaning they could fire
      from leveling alone without ever buying that OS tier. Fixed to check `P.up.os` instead;
      verified a high-level/no-OS-bought save no longer triggers them, and a low-level/all-OS-owned
      save does.
- [x] Also fixed, while in the area: the manual worker's code display was revealing characters on
      a passive timer regardless of input (same accumulator auto agents use), so it visibly
      "auto-typed" before any keypress — contradicting the whole hackertyper premise. Split it so
      only auto agents use the passive accumulator; the manual worker now reveals code exclusively
      via `mashCode()`. Verified: blank terminal (just the blinking cursor) after 3s of zero input,
      text appears only once real keypresses are sent; auto agents' passive typing unaffected.
- [x] Added a "Triple Digits" (🏆) achievement for reaching level 100 — the milestone had zero
      recognition otherwise. Total achievements: 22 (was 21).
- [x] Verify end-to-end; update `guide.md`/`todo.md`; commit + push

### Phase 3 — Hardware slots (structural only, no patches yet) ✅ DONE
- [x] Replaced the repeatable Hardware upgrades (RAM/CPU/SSD/Monitor/GPU) with empty equip slots:
      RAM, CPU, Hard Drive, Monitor, GPU, Modem (`SLOTS`/`SLOT`, `P.equip`). Coffee (Espresso
      Machine) and Autocomplete Assist stay as repeatable Hardware purchases — they were never
      part of the itemization scope.
- [x] Items drop with a base type + item level: `rollItem()` picks a retro name from
      `RETRO_NAMES` keyed to `P.up.os` (era = *ownership*, not `themeChoice`'s display-only
      preference) and an ilvl of `round(P.level * rand(0.8, 1.2))`. First pass has 3-4 names per
      era, not exhaustive — fine per the plan's own "content-authoring pass, not a design
      decision" note.
- [x] Drop resolution wired into `resolveTask()`: the existing 16% drop chance now branches
      70% real Hardware (`dropHardware()`) / 30% flavor Loot (`addLoot()`, unchanged). A drop
      auto-equips if its ilvl beats the current item in that slot, otherwise it's auto-salvaged
      for `round(ilvl*2)+1` credits — no candidate-comparison UI yet, that's Phase 4's Toolbox job.
- [x] Shop gained a "🔧 Equipped Hardware" section: one card per slot showing the equipped item's
      name/ilvl (or "Stock" if empty) with an Unequip button (disabled when empty).
- [x] `recompute()` rewired so each slot's *ilvl* (not a purchase level) drives its multiplier:
      RAM 2%/ilvl speed, CPU 3%/ilvl XP, Hard Drive 2.5%/ilvl credits, Monitor 0.15×ilvl passive
      credits/sec, GPU 0.5%/ilvl crit (cap 60%), Modem 0.2%/ilvl success (cap +10%) and
      0.5%/ilvl offline-earning efficiency (cap 90%, replacing the old flat 50%).
  - Did **not** add a minimum-player-level-to-equip gate from the original checklist item — ilvl
    already scales with level, so a low-level player naturally can't roll a high-ilvl item, and a
    separate gate would just be an extra rule to explain for no real balance gain. Dropped as
    unnecessary rather than deferred.
- [x] Migration for old saves (no `"equip"` key): converts existing `up.ram/cpu/ssd/monitors/gpu`
      purchase levels into starter equipped items (×6 for ram/cpu/harddrive/gpu, ×5 for monitor,
      matching their old power curves approximately — real tuning deferred to playtesting, already
      an open question below). `up.gpu`/etc. purchase-level fields are left in the save (harmless,
      just unread) rather than deleted, since nothing else references them anymore.
- [x] Verify end-to-end: recompute() formulas checked by code review; fresh-save slot UI
      (all empty, Unequip disabled) confirmed visually; known-value equip state confirmed
      correct card rendering + working Unequip button + persistence; **migration test** (old save
      with `ram:5/cpu:3/ssd:2/monitors:4/gpu:0`, no `equip` key) confirmed exact expected
      conversion (ilvl 30/18/12/20, gpu stayed `null` since old level was 0); **natural-drop
      test** (simulated real key-mashing via CDP `Input.dispatchKeyEvent` for 35s at high stats)
      confirmed all 6 slots fill with real equipped items purely through normal task resolution,
      proving `dropHardware()` is actually reachable through live play, not just injectable state.
- [x] Update `guide.md`/`todo.md`; commit + push

### Phase 4 — Toolbox & crafting slot ✅ DONE
- [x] Card-list inventory (`P.toolbox`) as a new **🧰 Toolbox** tab alongside **🛒 Upgrades** in the
      existing shop aside (tab buttons in `shopHead`, two panes toggled by `setShopTab()`) — reused
      the shop's own `.card`/`.shopCat` patterns rather than building a second modal from scratch.
      Filterable by slot (dropdown) and rarity (dropdown, currently only "Stock" since Phase 5's
      rarity tiers don't exist yet — the control is real and wired, just not interesting until then).
- [x] **Changed the Phase 3 drop rule as part of this**: a slot with nothing equipped still
      auto-equips a new item (nothing to compare yet), but a slot that's already filled now sends
      the new item to the Toolbox instead of Phase 3's auto-equip-if-better/auto-salvage. This was
      necessary for "stockpile candidates and decide" to mean anything — auto-equip-if-better would
      have keept the Toolbox permanently empty in practice. `addHardwareItem()` is the shared
      equip-or-stash helper both natural drops and Toolbox rolls call into.
- [x] "🎲 Roll for Hardware" — gamble credits for a random item in a chosen slot (`rollForSlot()`),
      cost `round(15 + level*3)`, flat across slots. Implemented **×1** and **×10** buttons per slot;
      deliberately dropped the "max" variant from the original Bulk-buy idea as unnecessary UI
      clutter for the value it'd add (×10 already covers "buy a bunch at once").
- [x] Decommission (`decommissionItem()`) — same salvage formula as Phase 3's auto-salvage
      (`round(ilvl*2)+1` credits), now a manual action on any stash card instead of an automatic
      fallback.
- [x] Dedicated crafting slot — **🛠 The IDE**: a single `P.craftSlot` staging spot, separate from
      both the stash and equipped gear. Stash cards get a "→ IDE" action; the IDE card itself offers
      Equip or "↩ Toolbox". No crafting verbs attach to it yet (that's Phase 5) — it's real,
      persisted, structural plumbing for Phase 5 to build on, not a functional crafting bench yet.
- [x] Toolbox capacity: capped at 18 items (`TOOLBOX_CAP`); past that the single lowest-ilvl item
      auto-scraps for credits so saves can't grow unbounded from repeated rolling.
- [x] Unequip (in the Equipped Hardware section) changed from Phase 3's "delete the item" to
      "return it to the Toolbox" — now that a real stash exists, deleting on unequip would've been
      a step backward.
- [x] Migration: pre-Phase-4 saves get `toolbox:[]`/`itemSeq:0` for free (new `PERSIST` keys not
      present in old saves just keep `defaults()`'s values); their already-equipped items are
      backfilled with an `id`/`rarity` on load so Unequip-into-Toolbox and stash filtering work on
      gear equipped before this update.
- [x] Verify end-to-end: syntax-checked the script block standalone; headless-driver pass covering
      tab switching, rolling ×1 and ×10 into a full slot's Toolbox (confirmed no auto-equip since
      the slot was occupied), slot/rarity filtering, sending a stash item to the IDE then equipping
      from there (confirmed the previously-equipped item returned to the stash, net Toolbox count
      unchanged), decommissioning (confirmed credit refund), and unequip-returns-to-Toolbox
      (confirmed the unequipped item reappears in the stash rather than vanishing). No console
      errors; screenshots confirmed the tabbed layout, IDE staging card, and stash list all render
      and sort sensibly (highest ilvl first).
- [x] Update `guide.md`/`README.md`; commit + push

### Phase 5 — Patches + crafting materials
- [ ] Tiered, weighted patch tables (slot-specific + generic pools), gated by item level
- [ ] Material-drop economy wired to task types, using `P.loc`/`P.deploys`/`P.bugsFixed`
- [ ] Material progress meters (soft-pity bars)
- [ ] Spend materials + credits on the item in the crafting slot (add/reroll actions)
- [ ] Verify end-to-end; update `guide.md`/`todo.md`; commit + push

### Phase 6 — Missions
- [ ] Rotating contract board (3 active choices), board refresh on full completion
- [ ] Scaling reroll cost (uncompleted-mission count × mission level)
- [ ] Craftable mission mods (Sprint Config currency)
- [ ] Mission item rewards
- [ ] Verify end-to-end; update `guide.md`/`todo.md`; commit + push

### Phase 7 — Depth & polish
- [ ] Milestone-boss gates for new slots (Modem/Cooling/Neural Interface) and max item level
- [ ] Optional set bonuses (2+ Custom-Built+ slots)
- [ ] Legendary Build uniques
- [ ] Endgame Neural Interface slot (gated to STARSHIP OS era)
- [ ] Verify end-to-end; update `guide.md`/`todo.md`; commit + push

**Workflow per phase:** branch off `main`, work the sub-steps above, run the full verify pass,
update docs, then merge to `main` (which auto-deploys via GitHub Pages) only once the phase is
complete — never mid-phase. This keeps the live site always on a *finished* phase, never a
half-built one.

## Open questions still to settle

- Exact XP-curve constants for the 1–100 rework (needs some playtesting/math, not a design call).
- Full patch tier tables (value ranges + weights per tier per patch line) — first draft can be
  rough and rebalanced after playtesting.
- Exact soft-pity formula for material progress meters (linear per attempt? weighted by task
  difficulty? guarantee at 100% or just heavily favored?).
- Decommission conversion rates (how much credit/material for a Stock vs. Custom-Built item).
- Full retro-hardware name list per slot per era (content-authoring pass, not urgent).
- Toolbox UI: confirm card-list works once there's a real prototype, vs. revisiting spatial
  inventory later if the card list feels too flat.

## Feedback

(Raw notes get folded into the sections above as they come in — this stays as a scratchpad for
whatever's next.)
