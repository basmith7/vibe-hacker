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
that only moves when you type or tap. That's deliberate: nothing is explained up front, every
system reveals itself the moment you can afford to buy into it.

- Fill the bar once (clear your first task) → the **$ credits** counter appears.
- Reach **10 credits** → the **🛒 upgrades** button appears.
- Your **first purchase** reveals the whole cockpit — status bar, level/stage HUD, and the
  globe/telemetry panels (still locked until you buy their specific unlocks).

If you've been playing a while, the shop and full UI are already unlocked and this is just
history — the funnel only runs once, on a brand-new save.

## Stats

Every stat has the same job: it's checked against a task's difficulty to determine your success
chance and your speed at that specific *kind* of task. Two stats also have a global side-effect:

| Stat | Governs tasks like… | Extra effect |
|---|---|---|
| ⌨️ **Coding** | Write your first function, fix a typo, center a div | — |
| ⚡ **Git-Fu** | Rebase, merge conflicts, force-push | — |
| 🧠 **Focus** | Deep work, ignoring Slack, pomodoros | **Speeds up every task**, not just its own |
| 🐛 **Debugging** | Heisenbugs, race conditions, prod fires | — |
| 🏛 **Architect** | System design, abstractions, migrations | — |
| 🚀 **DevOps** | Deploys, Kubernetes, CI, on-call | — |
| 🧮 **Algorithms** | Big-O, LeetCode, DP | — |
| ✨ **Rizz** | Code review, standups, demos | **Softens failure damage**, up to −50% at Rizz 60+ |
| ☕ **Caffeine** | Coffee, breaks, sleep | **Speeds Sanity regen**; also raised by the Espresso Machine upgrade |

You start with only Coding. The rest unlock one at a time via **🧠 Learn a New Skill** in the
shop — buying it adds the next stat to the task pool *and* gives it a visible chip with a `+`
button, at the same time. There's no stat you can see but not use.

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
by your CPU/SSD upgrades and Machine/AI-Model tiers. There's also a **crit chance** (from the
GPU upgrade) for a 3× payout on that task. You gain a little Sanity back, your streak grows,
and there's a 16% chance of **loot**.

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

You start as the only worker — a **manual** one, meaning tasks only advance when you press a
key or tap the screen (this is also how the intro's hackertyper terminal works). Buying
**👥 Hire an Agent** in the shop adds an *automatic* worker that codes on its own, no input
needed. Each further hire adds another, up to 8 workers total (you + 7 hires). Auto agents
always work; your manual slot only works when you're actively mashing/tapping — so hiring
agents is what turns this from an active clicker into a true idle game. The **🪄 Autocomplete
Assist** upgrade (Hardware) is a gentler alternative: instead of adding a whole new worker, it
gives your *own* manual slot a slow passive trickle, so it makes progress even when you're not
actively typing — up to 75% of a full auto-worker's rate at max level, on top of whatever
mashing adds.

## Credits, XP, and leveling

- **Credits** are the shop currency, earned per successful task (plus passive income from
  Monitors, once bought).
- **XP** fills a level bar; each level needs progressively more (about +13% and +22 flat over
  the last). Leveling up grants **2 + (level ÷ 8) skill points**, fully heals Sanity, and every
  3rd level bumps your **title** — Script Kiddie → Intern → … → CTO → **Benevolent AGI** (20
  titles total).
- A separate **stage/plot bar** fills from task progress and advances your **career stage**
  (Day 1 → Week 1 → … → Singularity Onset, 28 stages) — each stage raises task difficulty and
  is a slower, longer-term bar than the level bar. Running out of stages doesn't end anything;
  it just loops into a cosmetic "New Game+" lap counter and keeps going.

## The shop

Everything costs credits and falls into four sections:

### Getting Started
Always visible — this is the guided path, never hidden. **Hire an Agent**, **Learn a New
Skill**, **Install Telemetry** (reveals the charts panel), **Go Global** (reveals the world
map). These are one-time or tiered purchases that exist specifically to introduce a new system.

### Hardware (repeatable — each purchase gets a bit more expensive)
| Upgrade | Effect |
|---|---|
| 🪄 Autocomplete Assist | Your own manual slot auto-fills a bit on its own each second — +5%/level, capped at 15 levels (75%). You still need to type/tap for the rest; this never fully replaces you. |
| 🧠 RAM | +8% task speed per level |
| ⚙️ CPU Cores | +12% XP per level |
| 💾 SSD Array | +10% credits per level |
| 🖥️ Extra Monitor | +passive credits/sec (scaled by your Machine tier) |
| ☕ Espresso Machine | +max Sanity and faster regen |
| 🎮 Overclocked GPU | +3% crit chance per level (max 20 levels → 60% crit, capped) |

### Rigs (one-time tier upgrades — each tier replaces the last)
- **💻 New Machine** — Hand-me-down Laptop → … → Dyson-Sphere Cluster. Each tier multiplies
  *everything* (XP, credits, passive income) and adds a flat speed bonus. The single biggest
  lever in the game.
- **🤖 Upgrade AI Model** — Naive Autocomplete → … → AGI (do not release). Adds a flat bonus to
  every task's success chance (up to +16%) plus a speed bonus.
- **🖥️ Upgrade OS** — see **Themes** below. Also lives here because it's the same "buy a tier,
  it just takes effect" pattern as the other two.

### Automation (one-time toggles)
- **🌙 Cloud Sync** — earn credits while the tab is closed (up to 8 hours away, at 50%
  efficiency).
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

## Loot

A successful task has a 16% chance to drop a piece of flavor loot (Mechanical Keyboard of
Clackening, Rubber Duck of Debugging, etc.) and boost one random stat by a small amount. Purely
a bonus — there's no inventory to manage.

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

21 achievements unlock automatically as you play, from "Hello, World" (clear one task) to
"Serial Founder" (cash out 5 times) to "To The Stars" (reach the STARSHIP OS look). They show
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
sent anywhere — it's entirely local to your browser. **⟲ reset save** at the bottom of the shop
wipes it and starts over, after confirming. Before you've reached the shop (still in the intro
terminal), use the small **⟲** in the bottom-left corner instead — the shop needs 10 credits to
open, so that corner button is the only reset available before then.

## Controls

| Key / action | Effect |
|---|---|
| Mash any key / tap the screen | Drives your manual worker; surges the whole game briefly |
| Click the OS name (top-left) | Switch to any unlocked look |
| `U` | Open the shop |
| `T` | Cycle through your unlocked looks |
| `F11` | Fullscreen (browser-native) |
| `Esc` / `` ` `` | Boss key — hide behind a fake spreadsheet |
| `⟲ reset save` (bottom of shop) | Wipe your save and start over |
| `⟲` (bottom-left corner) | Same, but reachable before the shop opens |

## A few tips

- **Machine tiers are the biggest lever.** They multiply everything at once, so when you can
  afford one, it usually beats several smaller Hardware buys.
- **Focus helps every task, not just its own** — it's worth leveling even if you're not
  actively doing Focus tasks.
- **Rizz is a defensive stat.** If you're burning out a lot, it's the fix, not more Sanity
  upgrades.
- **Don't rush your first IPO.** Equity scales with how much you've earned *and* how far you've
  gotten — a longer first run banks more permanent bonus than cashing out the moment you hit
  level 10.
- **Auto-Buyer will spend on Rigs tiers, including OS.** If you want to control when your look
  changes, hold off on Auto-Buyer, or just enjoy the surprise.
