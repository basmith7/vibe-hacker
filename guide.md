# vibe hacker — player's guide

Everything in the game, explained. If [README.md](README.md) is the pitch, this is the manual —
what every stat does, how tasks and damage actually work, what each upgrade buys you, and how
the long game (prestige, achievements, themes) fits together.

## The core loop

1. **Workers clear tasks.** Each task is tied to one stat. Clearing it earns XP + credits and
   levels that stat a little. Failing it costs you Sanity (HP).
2. **Credits buy upgrades** in the 🛒 shop, which make tasks faster, more lucrative, and more
   reliable — and unlock new panels, stats, and looks.
3. **XP fills a level bar; a separate "plot" bar fills toward the next career stage.** Both loop
   forever, with escalating rewards and escalating difficulty.
4. Eventually you can **prestige (IPO)** for a permanent bonus and start a fresh, stronger run.

Everything below explains one layer of that loop in detail.

## Getting started

The game starts as a **full-screen terminal** — just you, one stat (Coding), and a progress bar
that only moves when you type or tap. That's deliberate: nothing is explained up front, and you
buy your way into each app one at a time.

- Fill the bar once (clear your first task) → the **$ credits** counter appears.
- Reach **10 credits** → the **🛒 upgrades** button appears.
- Your **first purchase** brings up the status bar and the level/stage HUD.
- From there, apps **tile into the screen** as you unlock them: **👥 Hire an Agent** opens the
  Agent Swarm, **📊 Install Telemetry** opens the charts, **🌐 Go Global** opens the Deploy Mesh.
  The more apps you own, the more the layout splits (tmux-style) to fit them beside the terminal.
  (More systems become their own apps — and these tiles become draggable windows — in later updates.)

If you've been playing a while, everything you'd already unlocked stays unlocked — the one-by-one
funnel only gates a brand-new save.

## Stats

Every stat has the same job: it's checked against a task's difficulty to determine your success
chance and your speed at that specific *kind* of task. One stat also has a global side-effect:

| Stat | Governs tasks like… | Extra effect |
|---|---|---|
| ⌨️ **Coding** | Write your first function, fix a typo, center a div, rebase, merge conflicts | — |
| 🧠 **Focus** | Deep work, ignoring Slack, pomodoros | **Speeds up every task**, not just its own |
| 🐛 **Debugging** | Heisenbugs, race conditions, prod fires | — |
| 🏛 **Systems** | System design, abstractions, migrations, deploys, Kubernetes, on-call | — |
| 🧮 **Algorithms** | Big-O, LeetCode, DP | — |

You start with only Coding. The rest unlock one at a time via **🧠 Learn a New Skill** in the
shop — buying it adds the next stat to the task pool *and* gives it a visible chip with a `+`
button, at the same time. There's no stat you can see but not use.

*(Rizz and Caffeine used to be their own grindable stats — softening failure damage and speeding
Sanity regen, respectively. They're retired as active stats for now; a future update reintroduces
both as equippable gear patches instead, see `docs/crafting-update.md`.)*

### How stats raise

- **Clearing a task** bumps the stat that task used by a small random amount (~0.4–1.0).
- **Loot** (see below) bumps a random stat by a bit more (~0.6–1.6) — even one you haven't
  unlocked yet gets a tiny head start for later.
- **Skill points** (✦ SP), earned on level-up, can be spent on *any* stat via its `+` button —
  this is the only stat growth you fully control.
- **Auto-Allocate SP** (an Automation upgrade) spends your skill points for you, always on
  whichever stat is currently lowest.

## Tasks: success, speed, and damage

Each worker (see **Workers & agents** below) is always doing *something*. When a task is
assigned, its **difficulty** is `5 + (stage × 1.35) + a little randomness` — so tasks get
harder as your career advances, independent of your stats.

**Success chance** starts at 58%, then:
- **+4.5%** for every point your stat is *above* the task's difficulty (and −4.5% per point
  below it — a stat well below difficulty can make a task genuinely risky).
- **+1%** per point of your current streak, capped at +15%.
- **+ your AI Model's success bonus** (see **Rigs**, up to +16% at the top tier).
- Clamped between 15% and 98% — nothing is ever a guaranteed win or an auto-loss.

*(Exception: during the intro, your one manual worker always succeeds — the tutorial doesn't
let you fail before Sanity even exists on screen.)*

**Task duration** is `(5.5 + difficulty × 0.35) ÷ speed`, where speed combines your relevant
stat, your Focus, and your hardware (RAM, Machine, and AI Model speed bonuses all multiply
together). Better stats and better hardware both directly shorten every task.

**On success:** XP and credits both scale with difficulty and your stage, then get multiplied
by your equipped CPU/Hard Drive and Machine/AI-Model tiers. There's also a **crit chance** (from
your equipped GPU) for a 3× payout on that task. You gain a little Sanity back, your streak
grows, and there's a 16% chance of a drop — see **Hardware slots** below.

**On failure:** you take damage equal to roughly `difficulty × 0.4–0.9`, reduced by up to 50%
if your Rizz is high. Your streak resets to zero, and you get a small consolation XP trickle.
If Sanity hits 0, you **burn out**: you lose 40% of your current level's XP progress, Sanity
partially recovers, your streak resets, and Caffeine takes a small hit. It's a setback, not a
game over.

## Sanity (HP)

Your Sanity bar is your buffer against burnout. It slowly regenerates on its own (faster with
Caffeine and the Espresso Machine upgrade), heals a little on every successful task, and fully
refills whenever you level up or advance a career stage. Its maximum grows with your level and
with Espresso Machine levels. Treat it as a soft resource — running it to zero isn't fatal, just
costly.

## Workers & agents

You start as the only worker — a **manual** one, living in the **Terminal** app, meaning tasks
only advance when you press a key or tap the screen (this is also how the day-1 hackertyper
terminal works). Buying **👥 Hire an Agent** in the shop opens the separate **Agent Swarm** app
and adds an *automatic* worker that codes on its own, no input needed. Each further hire adds
another, up to 8 workers total (you + 7 hires). Auto agents
always work; your manual slot only works when you're actively mashing/tapping — so hiring
agents is what turns this from an active clicker into a true idle game. The **🪄 Autocomplete
Assist** upgrade (Hardware) is a gentler alternative: instead of adding a whole new worker, it
gives your *own* manual slot a slow passive trickle, so it makes progress even when you're not
actively typing — up to 75% of a full auto-worker's rate at max level, on top of whatever
mashing adds.

## Credits, XP, and leveling

- **Credits** are the shop currency, earned per successful task (plus passive income from
  Monitors, once bought).
- **XP** fills a level bar; each level needs progressively more (about +10% and +18 flat over the
  last). Leveling up grants **2 + (level ÷ 8) skill points**, fully heals Sanity, and every 5th
  level bumps your **title** — Script Kiddie → Intern → … → CTO → **Benevolent AGI** (20 titles,
  spanning **level 1 to 100**). Level 100 is a real, deliberately hard-fought milestone — roughly
  35 million cumulative XP — and going past it gets brutal fast (150 needs ~4 billion). Leveling
  never hard-caps, it just keeps getting steeper.
- A separate **stage/plot bar** fills from task progress and advances your **career stage**
  (Day 1 → Week 1 → … → Singularity Onset, 28 stages) — each stage raises task difficulty and
  is a slower, longer-term bar than the level bar. Running out of stages doesn't end anything;
  it just loops into a cosmetic "New Game+" lap counter and keeps going.

## The shop

Everything costs credits and falls into four sections:

### Getting Started
Always visible — this is the guided path, never hidden. **Hire an Agent** (opens the Agent Swarm
app), **Learn a New Skill**, **Install Telemetry** (opens the charts app), and **Go Global**
(opens the Deploy Mesh app). Each app you unlock tiles into the screen beside the terminal.

### Hardware (repeatable — each purchase gets a bit more expensive)
| Upgrade | Effect |
|---|---|
| 🪄 Autocomplete Assist | Your own manual slot auto-fills a bit on its own each second — +5%/level, capped at 15 levels (75%). You still need to type/tap for the rest; this never fully replaces you. |
| ☕ Espresso Machine | +max Sanity and faster regen |

RAM, CPU, Hard Drive, Monitor, GPU, and Modem are no longer bought here — they're **equip
slots**, filled by drops. See **Hardware slots** below.

### Rigs (one-time tier upgrades — each tier replaces the last)
- **💻 New Machine** — Hand-me-down Laptop → … → Dyson-Sphere Cluster. Each tier multiplies
  *everything* (XP, credits, passive income) and adds a flat speed bonus. The single biggest
  lever in the game.
- **🤖 Upgrade AI Model** — Naive Autocomplete → … → AGI (do not release). Adds a flat bonus to
  every task's success chance (up to +16%) plus a speed bonus.
- **🖥️ Upgrade OS** — see **Themes** below. Also lives here because it's the same "buy a tier,
  it just takes effect" pattern as the other two.

### Automation (one-time toggles)
- **🌙 Cloud Sync** — earn credits while the tab is closed (up to 8 hours away). Base efficiency
  is 50%, improved by your equipped Modem (up to 90%).
- **🎯 Auto-Allocate SP** — spends skill points for you, always on your current weakest stat.
- **🛒 Auto-Buyer** — automatically buys the cheapest *affordable* upgrade every ~1.2 seconds
  (it'll happily buy a Rigs tier — including a new OS look — without asking, so don't be
  surprised if your theme changes on its own once you own this).

### Shop visibility
Hardware/Rigs/Automation cards — and their category headers — stay **hidden** until your
**peak-ever credit balance** (not your current balance) has reached **50% of that item's
price**, at any point. Once revealed, an item stays revealed forever, even if you immediately
spend your credits on something else. Getting Started items and the IPO card are exempt and
always shown.

## Hardware slots

A successful task has a 16% chance to drop something — most of the time (70%) it's a real
**Hardware item** for one of six equip slots: 🧠 RAM, ⚙️ CPU, 💾 Hard Drive, 🖥️ Monitor,
🎮 GPU, 📡 Modem. Each item has an item level (ilvl) that scales roughly with your character
level, and a retro-flavored name drawn from an era matching your current OS tier (e.g. an early
OS gets "Orange II RAM"; a late one gets "Singularity Core RAM").

- If a slot is **empty**, a new item for it **auto-equips** immediately — nothing to choose
  between yet, so there's no reason to make you do it manually.
- If that slot is **already filled**, the new item goes to your **🧰 Toolbox** stash instead
  (see below) so you can compare it against what's equipped before deciding.

Each slot has a distinct effect, scaling with the equipped item's ilvl:
- 🧠 **RAM** — task speed
- ⚙️ **CPU** — XP per task
- 💾 **Hard Drive** — credits per task
- 🖥️ **Monitor** — passive credits/sec
- 🎮 **GPU** — crit chance (capped at 60%)
- 📡 **Modem** — success chance and offline-earning efficiency (both capped)

The other 30% of drops are flavor **loot** (Mechanical Keyboard of Clackening, Rubber Duck of
Debugging, etc.) — a small one-time stat bump with no equip slot of its own.

## The Toolbox

Press the **🧰** tab at the top of the shop panel (next to **🛒**) to open the Toolbox — your
hardware inventory, separate from the Upgrades list:

- **🔧 Equipped Hardware** — the same 6 slots as before; **Unequip** returns that item to
  your stash instead of deleting it.
- **📦 Crafting Materials** — six materials, each with a count and a thin progress bar
  underneath. The bar is a soft-pity meter: every task that *could* drop that material nudges the
  bar forward even when it doesn't, so a long unlucky streak is smoothed out instead of possible
  forever — a full bar guarantees the next one.
- **🛠 The IDE (crafting bench)** — a single dedicated staging slot for "the item you're
  currently working on." Send a stash item here with **→ IDE**; while it's staged you can spend
  materials + credits on it (see **Patches & crafting** below), then either **Equip** it or send
  it **↩ Toolbox** back to the stash.
- **🎲 Roll for Hardware** — gamble credits for a random item in a specific slot instead of
  waiting on a task drop. Cost scales with your level and rises the same for every slot. Roll
  once or **×10** at a time.
- **Toolbox stash** — every item you haven't equipped or decommissioned, as a filterable card
  list (by slot and by rarity — **Stock → Modded → Custom-Built**, based on how many patches it
  has). Each card can **Equip** (swapping whatever's currently in that slot back into the stash),
  send **→ IDE**, or **Decommission** for a small credit *and material* refund. The stash holds 18
  items — past that, the single worst one auto-scraps for credits to make room.

## Patches & crafting

Once level 25+ items start dropping, Hardware can carry up to **4 patches** — small bonuses
layered on top of the item's base ilvl effect. An item's **rarity** is just how many patches it
has: **Stock** (0), **Modded** (1–2), **Custom-Built** (3–4). How many patch slots an item *can*
hold depends on its ilvl when it dropped (2 below ilvl 25, 3 below ilvl 60, 4 above).

Patches are either **slot-specific** (a bonus to that slot's own effect — e.g. RAM can roll extra
task speed, GPU extra crit chance) or **generic** (flat +stat to any of the 5 stats, +Max Sanity,
or reduced failure damage) and can roll on any slot. Better patch tiers are rarer and gated by the
item's ilvl, same as the item itself.

Patches are **never bought directly** — only earned as drops, then applied in **The IDE** using a
material + a small amount of credits:

| Material | Where it comes from | What it does in the IDE |
|---|---|---|
| 📝 Commit | any successful task (common) | Add a random patch to an open slot |
| 🩹 Hotfix | Debugging tasks | Reroll one patch's *value* (same patch, new number) |
| 🔀 Refactor Token | Systems tasks | Reroll one patch's *type* entirely |
| 📦 Full Rewrite | rare — hit every 1,000 total lines of code | Reroll *every* patch on the item |
| ⏪ Revert Commit | rare | Strip the item back to Stock (no patches) |
| 🔗 Feature Branch Merge | rare, level 40+ | Add a patch slot beyond the item's current count (up to 4) |

**Decommissioning** unwanted gear also refunds a Commit or two on top of the usual credits,
scaled to the item's ilvl — so gear you don't want to keep still feeds the crafting economy
instead of just disappearing.

## Missions

The **📋 Mission Board** (also in the Toolbox tab) always has **3 active contracts**, each tied to
a stat: 🐛 Debugging Sprint, 🚀 Deploy Week, 🧮 Algorithm Grind, 🎯 Focus Block, or the stat-agnostic
⚡ Hackathon. Every task you complete counts toward *all three* — nothing stalls just because you
weren't working on the "right" kind — but a task matching a mission's stat is both **weighted
higher** in what gets assigned to you and gives a chance at a **bonus material** on top of the
mission's normal drops.

Completing a mission pays out a lump sum of its bonus material, some **⚙️ Sprint Config**, and a
35% chance at a direct Hardware item. A slot stays "complete" on the board until *all three* are
done, at which point the whole board rerolls at once. You can also **reroll early** for credits —
cost scales with the level of whatever you'd be discarding, so an untouched board is cheap to
scrap but one you've already invested Sprint Config into costs more.

**Sprint Config** is missions' own crafting currency — spend it on an active mission to make it
bigger before it pays out: **Extend** (+3 tasks, a small permanent payout boost) or **Crunch**
(bigger payout boost, same length). Same add/reroll spirit as gear patches, applied to a mission
instead of an item.

## Endgame depth

A few systems only kick in once you're deep into a run:

- **Two more Hardware slots** — ❄️ **Cooling** (unlocks at **level 60**; boosts Sanity regen) and
  🔮 **Neural Interface** (unlocks once you own **STARSHIP OS**, the last Upgrade OS tier; its base
  effect is a small bonus to **all 5 stats at once**, unlike every other slot which only ever
  touches its own single effect).
- **Item level has a ceiling** tied to your current OS tier — buying a new OS doesn't just change
  your look, it also raises the best gear you can possibly find or roll. Outgrow MS-DOS and your
  drops outgrow it too.
- **Set bonus** — every **2 equipped items that are Custom-Built or better** (Legendary counts)
  adds a stacking **+5%** to task speed, XP, and credits. Full-clearing all 8 slots at Custom-Built+
  is a real, visible payoff, shown right in the Equipped Hardware header once it's active.
- **Legendary Build** — a vanishingly rare (~1%) alternative to a normal roll, dropped instead of
  crafted: a named item with fixed patches already on it (e.g. *Vim's Blessing*, *The ThinkPad X1
  of Legend*). Shown with a gold border and a ★ next to its level. You can still craft further
  patches onto one — it's a rare head start, not a permanently frozen item.

## Themes (Upgrade OS)

Your cockpit's look is tied to the **🖥️ Upgrade OS** purchase in Rigs, not to your level. Each
purchase advances one tier — **MS-DOS 6.22 → Windows 3.1 → Windows 95 → Windows 10 →
NEON//OS v6 → STARSHIP OS** — and immediately switches you to it. But buying a new tier doesn't
lock in that look forever: **click the OS name** (top-left, next to the logo) anytime to open a
menu of every look you've *ever* unlocked and switch back to it. Owning tier 4 doesn't cost you
the ability to display tier 1's look.

## Prestige (IPO / Equity)

Once you're **level 10+** and have earned enough lifetime credits, the shop's top card lets you
**cash out**. This is a hard reset — level, stats, credits, every upgrade (including your
Machine, Model, and OS tier) goes back to the very start — in exchange for permanent
**Equity**, worth **+2% XP and credits, forever**, stacking with every future cash-out.

The amount of Equity you earn depends on how much you've earned this run, your stage, and your
level — roughly `√(total earned ÷ 15,000) + stage + level × 0.15`, rounded down. Bigger, longer
runs bank more Equity per cash-out. Achievements, lifetime totals, and your best streak all
survive a cash-out; only the active run resets.

This is a different thing from the stage-list "New Game+" mentioned above — that one is just a
cosmetic lap counter for finishing all 28 stages, with no reset. IPO is the real prestige loop.

## Achievements

22 achievements unlock automatically as you play, from "Hello, World" (clear one task) to
"Serial Founder" (cash out 5 times) to "Triple Digits" (reach level 100). They show
up as a toast the moment you earn them and live in a checklist at the bottom of the shop with a
running completion count. If you already qualify for one when you load an old save, it's
granted silently — no spam on load.

Most of the list stays **hidden** until you're close: progress-based achievements (task counts,
level thresholds, streaks, etc.) only appear once you're **75% of the way there**, so the panel
doesn't open as a wall of 21 distant goals. A few are single-trigger events with no meaningful
"75%" (Touch Grass/burnout, Critical Hit, IPO Day) — those stay fully hidden until the instant
you actually earn them. "Hello, World" is always visible as a first nudge.

## Saving

Your run auto-saves every few seconds to a cookie, with a `localStorage` mirror as a fallback
(cookies don't work on `file://`, which is how the mirror keeps local play working). Nothing is
sent anywhere — it's entirely local to your browser. **⟲ sudo rm -r /** at the bottom of the shop
wipes it and starts over, after confirming. There's no reset option during the intro terminal —
the shop needs 10 credits to open, and reaching it is quick enough that waiting is fine.

## Controls

| Key / action | Effect |
|---|---|
| Mash any key / tap the screen | Drives your manual worker; surges the whole game briefly |
| Click the OS name (top-left) | Switch to any unlocked look |
| `U` | Open the shop |
| `T` | Cycle through your unlocked looks |
| `F11` | Fullscreen (browser-native) |
| `Esc` / `` ` `` | Boss key — hide behind a fake spreadsheet |
| `⟲ sudo rm -r /` (bottom of shop) | Wipe your save and start over |

## A few tips

- **Machine tiers are the biggest lever.** They multiply everything at once, so when you can
  afford one, it usually beats waiting on a Hardware slot upgrade to drop.
- **Focus helps every task, not just its own** — it's worth leveling even if you're not
  actively doing Focus tasks.
- **Rizz is a defensive stat.** If you're burning out a lot, it's the fix, not more Sanity
  upgrades.
- **Don't rush your first IPO.** Equity scales with how much you've earned *and* how far you've
  gotten — a longer first run banks more permanent bonus than cashing out the moment you hit
  level 10.
- **Auto-Buyer will spend on Rigs tiers, including OS.** If you want to control when your look
  changes, hold off on Auto-Buyer, or just enjoy the surprise.
