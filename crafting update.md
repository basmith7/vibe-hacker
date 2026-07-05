# Crafting Expansion — Design Plan

A Path-of-Exile-style itemization layer bolted onto the existing career sim: instead of flat
"buy Lv N of RAM" purchases, RAM/CPU/GPU/etc. become **equipped hardware** with **rollable
patches** (affixes), fed by **crafting materials** earned from specific task types, with
**missions** as a way to aim that RNG instead of just hoping.

This replaces the current repeatable Hardware upgrades (RAM/CPU/SSD/Monitor/Coffee/GPU) and the
random-flavor Loot system. **Rigs** (Machine/Model/OS tiers) and **Automation** stay exactly as
they are — this only touches the Hardware layer.

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
| 🖥️ Monitor | Passive credits/sec |
| 🎮 GPU | Crit chance / crit multiplier |
| 📡 Modem *(new)* | Task failure-chance reduction, offline-earning efficiency |
| ❄️ Cooling *(maybe, later)* | Sanity/burnout-adjacent effects |
| 🧠 Neural Interface *(endgame, maybe)* | Big multi-stat patch pool — gated to the STARSHIP OS era |

SSD's old credit-multiplier and Coffee's old Sanity effect don't get their own slot — they become
**generic patches** (see below), rollable on *any* slot, since the user's slot list didn't call
out storage or coffee as physical slots.

**Autocomplete Assist** stays a standalone repeatable purchase, *not* part of the slot/patch
system — automating your own typing doesn't fit "damage roll on gear" cleanly.

Each slot holds one equipped item. Empty = the old "Lv 0" baseline (no bonus). Items are gated by
a minimum player level to equip, so a lucky early drop can't be slotted in day one.

## Patches (affixes)

- Up to **4 patches** per item.
- **Slot-specific** pool (the table above) + a **generic** pool usable on any slot:
  flat +stat (any of the 5), credit multiplier (old SSD), Sanity max/regen (old Caffeine),
  failure-damage reduction (old Rizz).
- Each patch line has **tiers**; better tiers have **lower roll weight** (rare) and are **gated
  by the item's Build Version (ilvl)** — a low-ilvl item literally cannot roll the top tier.
- Item level is set at drop time, roughly tied to your current stage/player level (like a
  monster-level→item-level relationship).

## Crafting materials

Certain task types drop materials instead of (well, in addition to) credits — tied to the merged
stats plus the currently-dead `P.loc` / `P.deploys` / `P.bugsFixed` counters, finally put to use:

| Material | Dropped by | Does |
|---|---|---|
| **Commit** | any task (baseline, common) | Add a random patch to an item with open slots |
| **Hotfix** | Debugging tasks (`P.bugsFixed`) | Reroll one patch's *value* (same mod, new number) |
| **Refactor Token** | Systems tasks (`P.deploys`) | Reroll one patch's *type* entirely |
| **Full Rewrite** | rare, any task (`P.loc` milestones) | Reroll *all* patches on an item |
| **Revert Commit** | rare | Strip an item back to Stock (no patches) |
| **Feature Branch Merge** | rare, late-game | Add a patch slot beyond the item's current count (up to 4) |

## Missions — aiming the RNG

Pure random material drops are frustrating once you're hunting one specific thing, so add
**Missions**: short, player-selectable contracts that bias what you earn instead of leaving it
fully random.

- Pick a mission from a small rotating board (e.g. 3 active choices): **"Debugging Sprint"**
  (next N tasks are Debugging-weighted and drop bonus Hotfixes), **"Deploy Week"** (Systems tasks
  favored, bonus Refactor Tokens), **"Hackathon"** (all task types, bonus flat Commits, shorter
  duration, higher intensity).
- Missions run for a fixed number of tasks or a time window, then complete and the board
  refreshes — a light, repeatable layer, not a separate minigame.
- This gives players **agency over an otherwise pure-RNG economy**: still no guarantees on any
  single roll, but you can steer *which* material you're accumulating toward, which matters a
  lot once crafting a specific patch is the goal.
- Natural home for this is a small panel or a tab inside The IDE (the crafting bench), so
  crafting and mission-selection live in one place.

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
| Orb: add random mod | **Feature Flag** |
| Orb: reroll mod value | **Hotfix** |
| Orb: reroll mod type | **Refactor Token** |
| Orb: reroll all mods | **Full Rewrite** |
| Orb: strip to normal | **Revert Commit** |
| Orb: add mod slot | **Feature Branch Merge** |
| Bounty / contract | **Mission** |

## Backlog items this absorbs

- **More upgrade branches (networking)** → the Modem slot
- **Stat synergies / set bonuses** → optional Phase 5 (2+ Custom-Built+ slots granting a bonus)
- **Milestone bosses per stage** → Phase 5 gate for unlocking new slots (Modem/Cooling/Neural
  Interface) or raising the max obtainable Build Version
- **Wire up write-only state** (`P.loc`/`P.deploys`/`P.bugsFixed`) → crafting material sources,
  exactly as designed above — no longer dead trackers

## Phased delivery

1. **Stat consolidation** — merge Coding+Git-Fu and Architect+DevOps, retire Rizz/Caffeine as
   active stats, rewrite the task pool to 5 stats, migrate existing saves. Foundational — every
   later phase assumes the final 5-stat list.
2. **Level 1–100 rework** — retune XP curve, re-space the 20 titles across the full range.
3. **Hardware slots (structural only)** — replace the repeatable Hardware upgrades with empty
   equip slots (RAM/CPU/Monitor/GPU/Modem); items drop with a base type + ilvl, no patches yet;
   equip/unequip UI.
4. **Patches + crafting materials** — tiered weighted patch tables, the material-drop economy,
   The IDE (crafting bench UI) to spend materials on equipped gear.
5. **Missions** — the rotating contract board that biases material drops toward player choice.
6. **Depth & polish** — milestone-boss slot/ilvl gates, optional set bonuses, Legendary Build
   uniques, the endgame Neural Interface slot.

Each phase is independently shippable and testable before starting the next.

## Open questions to settle before Phase 1 starts

- Exact XP-curve constants for the 1–100 rework (needs some playtesting/math, not a design call).
- Full patch tier tables (value ranges + weights per tier per patch line) — first draft can be
  rough and rebalanced after playtesting.
- Whether "Full Rewrite" / "Feature Branch Merge" are earnable drops or shop-purchasable with
  credits as a safety valve for players with bad luck.
- Mission board size/rotation cadence, and whether missions are free to pick or cost a small
  credit/material fee to start (a fee would stop players from just re-rolling the board for a
  favorable option with zero cost).
