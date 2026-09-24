# vibe hacker — player's guide

Everything in the game, explained. If [README.md](README.md) is the pitch, this is the manual —
what every stat does, how agents, queues and gear actually work, what each upgrade buys you, and
how the long game (prestige, achievements, themes) fits together.

## The core loop

1. **Agents clear tickets off a queue.** Every agent — including *you* — has the same small sheet:
   three stats, four gear slots, an inventory and a sanity bar. The agent's **Quality** versus the
   queue's **difficulty** sets its success chance; **Speed** sets how fast the ticket clears.
2. **Cleared tickets pay credits** and sometimes **drop gear** at the queue's item level.
3. **Credits buy hires, seats, apps and OS tiers** in the 🛒 Store. Gear and the 🛠 IDE raise your
   agents' stats — there are **no agent levels**, item level *is* the progression axis.
4. Eventually you **prestige (IPO)** for permanent Equity and start again, stronger.

Everything below explains one layer of that loop in detail.

## Getting started

The game starts as a **full-screen terminal** — just you, one Backlog queue, and a progress bar
that only moves when you type or tap. That's deliberate: nothing is explained up front, and you
buy your way into each app one at a time.

- Fill the bar once (clear your first ticket) → the **$ credits** counter appears.
- Reach **10 credits** → the **🛒 Store** app tiles in beside the terminal.
- Your **first purchase** graduates you into the cockpit: the slim top strip fills in (logo, OS name,
  credits) plus a **📟 Status** app.
- From there, **every system is its own app, bought one at a time** from the Store's "Getting Started"
  list — each one **tiles into the screen** when you buy it: **👥 Hire an Agent** (the Agents roster),
  **📟 Status Readout**, **🏆 Trophy Case**, **📊 Install Telemetry** (charts), **🧰 Open Inventory**,
  **🔧 Equip Hardware**, **🛠 Launch the IDE** (crafting bench + materials) and **🌐 Go Global**
  (Deploy Mesh). The more apps you own, the more the layout splits (tmux-style).
  (Once you buy **Windows 3.1** in Upgrade OS, these tiles become draggable windows — see below.)

## Agents

An **agent** is a worker. You are agent zero; every **👥 Hire an Agent** purchase adds another.
All of them share one sheet — there is no separate "player character" any more, and **no agent
levels or skill points**.

### The three stats

| Stat | Fed by | What it does |
|---|---|---|
| 🎯 **Quality** | 🤖 Model slot | Success chance against the queue's difficulty (and crit) |
| ⚡ **Speed** | ⚙️ Compute slot | How fast a ticket clears |
| 🧠 **Stamina** | 🧠 Memory slot | Sanity pool and sanity regen |

The fourth slot, 🧰 **Tools**, doesn't feed a stat — it's the **credit multiplier** (and a home for
misc patches).

Every stat starts at a floor of **10** and rises purely with the **item level** of the gear in its
slot (plus patches). So a fully-geared agent is simply an agent wearing high-ilvl, well-patched
items — which is exactly what queues drop and what the IDE improves.

### Sanity and going rogue

Each agent has its own **sanity** bar. Its maximum is `50 + 2 × Stamina`, and it regenerates
continuously at `0.02 × Stamina` per second (faster with the *Well-Rested* patch or Deep Work).

- Every ticket costs a little sanity, **succeed or fail** — and a **failure costs far more**
  (roughly 30× the success cost). Running an agent on a queue it can't handle is therefore
  self-limiting: it will drain itself faster than it regenerates.
- If an agent's sanity hits **zero** it **goes rogue**. The one rogue mode so far is the
  **💸 Embezzler**: it drops its ticket, stops working, and siphons **0.265% of your *current* bank
  every second** (so it can never take you below zero — a bigger bank just bleeds faster). The
  running total shows up in the Terminal every ~10 seconds.
- It **recovers on its own** once its sanity climbs back to **50%** — but sanity regenerates at
  **half speed** while rogue, so a full unattended episode costs roughly a quarter of your bank
  (more for a low-Stamina agent, which takes longer to recover).
- Or **Kill -9** it: the button appears on its chip in the **Queues** app and its tile in **Agent
  Swarm**. It costs `8 × (the summed item level of its gear)`, restarts the agent at **half sanity**,
  and gives it a **20-second grace** during which it can't go rogue again. Rule of thumb: if your
  bank is more than about **4× the Kill -9 price**, pay; if you're broke, wait it out.
- This applies to **you** too — agent zero goes rogue like anyone else.

### Hiring and seats

Two separate purchases, both in the Store's **Team** section:

- **👥 Hire an Agent** — adds an agent to the roster. Cost is `150 × 3.2^(hires so far)`, so each
  one is a real step up. A new hire arrives with a **Junior starter kit** (ilvl 10 in all four
  slots) so it can work immediately. **Your OS caps the roster**: 1 agent on MS-DOS, 2 on
  Windows 3.1, 4 on Windows 95, 6 on Windows 10, 8 on NEON//OS, 10 on STARSHIP OS.
- **🪑 *Queue* Seat** — one card per board you own (one card each for the Backlog, Kanban, …). Cost is
  `150 × 2.2^(seats bought so far on that board) × 4^tier`, so seats on harder boards cost more. **An agent needs a seat
  to work**, so you buy these in step with hires; if no seat is free the new hire waits on the
  **Bench**. A board can't have more seats than your OS's hire cap.

The **🤖 Agent Swarm** app is the roster: one tile per agent showing its three stats, sanity bar, which
queue it's seated on (or *Bench*), a **Select** button, and a **Kill -9** button while it's rogue. The **selected** agent is the one the Equipment,
Inventory and IDE apps act on.

## Queues

A **queue** is where tickets come from. Each tier has a base **difficulty `D`** that drives
everything about it:

| Tier | D | OS needed |
|---|---|---|
| 📥 Backlog | 10 | MS-DOS |
| 🗂 Kanban | 25 | Windows 3.1 |
| 📋 Jira | 45 | Windows 95 |
| 📟 PagerDuty | 70 | Windows 10 |
| 🗺 The Roadmap | 100 | NEON//OS |
| 🏚 Legacy Monolith | 140 | STARSHIP OS |

You start with the Backlog and nothing else; it's simply "the queue" your terminal works until you
buy **📋 Open the Queues app** ($2,000, in Getting Started). That reveals the **Queues** app and the
Store's whole **Team** section.

- **Boards.** The Queues app shows one board per queue you own, plus the **🪑 Bench**. Every agent is
  a chip on exactly one of them.
- **Installing queues.** Each **Install <queue>** card in the Store (**$2K** Kanban, **$20K** Jira,
  **$200K** PagerDuty, **$2M** The Roadmap, **$15M** Legacy Monolith) only appears once you own the
  previous board, and needs the matching OS from the table above. A new board starts with one seat.
- **Seating.** Click a chip and a picker lists every board with that agent's **success %**, **★**
  and expected **$/s** there — or just drag the chip onto a board. Boards with no free seat are
  greyed out. Reseating abandons the ticket in progress.
- **The Bench.** A benched agent works nothing and regenerates sanity at the **full** rate — it's
  where new hires wait when no seat is free, and a fine place to park an agent that keeps failing.

### Configs (queue mods)

A **Config** (🗂) is an item, just like gear, except it doesn't equip on an agent — it **sockets into
a board** in the Queues app. Every board has **2 sockets** (Backlog, Kanban, Jira) or **3** (PagerDuty,
The Roadmap, Legacy Monolith). A Config always arrives with **one mod already on it**, and each mod
moves exactly one lever for that board:

| Mod | Lever | Effect |
|---|---|---|
| **Legacy Codebase** | Difficulty | Raises the board's effective `D` — harder, but payout scales with `D^1.5`, so it pays more too |
| **Enterprise Client** | Payout | Straight credits multiplier per ticket |
| **On-Call Rotation** | Drop band | Raises the **top** of the drop-ilvl band (the floor stays the board's base `D`) |
| **Crunch** | Speed | Tickets clear faster — more tickets per second, so more sanity drain per second too |
| **Open Source** | Materials | Raises the chance a cleared ticket grants a Commit |

Values are the same three tiers as any patch (Modded/Custom-Built), so a Config can carry more than
one mod once it has multiple patch slots. **Socket** one from an agent's Inventory (a Config card
shows **→ Socket** instead of Equip) or from the IDE after crafting it — either opens a picker of
every owned board with a free socket. **Unsocket** it from the board header and it returns to
whichever agent is currently **selected** — not necessarily the one who found it. Configs are crafted
on the same bench, with the same materials, as gear; only the patches that land on them are different
(mod patches never roll on gear, and gear patches never roll on Configs).

The classic loop: raise your agent's Quality until a board is a comfortable success rate, then
**mod the board with Legacy Codebase until it's barely still winnable** — squeezing the most payout
per ticket out of the gear you already have.

### Bounties

Every board with at least one seated, non-rogue agent occasionally spawns a **bounty** — a one-off
timed ticket layered on top of the normal queue, roughly every **90 seconds** (give or take 30%), one
at a time per board. It shows as a pill on the board header: `⏱ ‹name› · $pay · time left`, counting
down with a draining bar that pulses under 10 seconds.

- **Pickup** is automatic: the next agent on that board who finishes their current ticket picks it up
  (tagged `⏱ BOUNTY`, an orange bar). You can also work it by typing on your own agent, but **your
  manual ticket never blocks it** — an idle player isn't punished. If you and an automatic agent both
  end up working it, whoever clears it first gets the reward.
- **The timer only runs while you're actually playing** — it pauses with the boss key, a hidden tab,
  or a closed tab, same as everything else in the live loop. It does **not** advance while you're
  away (that's a future Automation purchase, Pager Integration).
- **Clearing it** pays roughly **3.5 tickets' worth of credits** — your Tools, Equity, and Deep Work
  bonuses apply just like an ordinary ticket — plus a reward: a materials bundle, a
  gear drop near the top of the board's band, or a Config. The very **first bounty you ever clear
  always pays a Config**, so you're guaranteed to see the socket UI early. (That's decided the moment
  each bounty spawns, not when it clears — so if two boards happen to spawn their first-ever bounty
  before either is cleared, both can pay a Config. Not a bug, just a quirk of how the reward is
  pre-rolled.)
- **Missing it** — failing the roll, or letting the clock run out — costs nothing beyond the usual
  sanity hit; the bounty just expires and the board waits for the next one.

For an agent on a queue of difficulty `D`:

- **Success chance** = `0.5 + (Quality ÷ D − 1) × 1.25`, capped at **95%**. So Quality equal to `D`
  is a coin flip, and about `1.36 × D` maxes you out.
- **Ticket duration** = `(4 + 0.3 × D) ÷ (1 + Speed ÷ 40)` seconds, clamped to 1.1–16 s, plus a
  short cooldown. Mashing keys briefly speeds everyone up (and is the *only* thing that moves
  **your own** agent — agent zero is manual, hires are automatic).
- **Payout** = `D^1.5 × Tools multiplier`, times your Equity and Deep Work bonuses. Harder queues
  pay far more — which is the whole reason to gear up and climb.
- **Drops**: a cleared ticket has a **10%** chance to drop a gear item, rolled at an item level in
  `[D, 0.92 × next tier's D]` — and capped by your **OS item-level ceiling**. That last clamp is
  why the OS ladder matters: it's the only thing that lets your gear outgrow the tier you're on.

## Credits, XP, and leveling

- **Credits** are the Store currency, earned per cleared ticket.
- **XP** still fills a level bar and your **title** still climbs (Script Kiddie → … →
  **Benevolent AGI**, 20 titles across levels 1–100), but levels are now **flavor only** — there
  are no skill points and nothing scales off your level.
- A separate **stage/plot bar** advances your **career stage** (Day 1 → … → Singularity Onset,
  28 stages). This is **story only** too; it doesn't change difficulty or rewards any more.

## Telemetry (the charts)

Bought via **📊 Install Telemetry**, four panels:
- **Credits** — live balance, income per second, and a graph of that rate over the last ~15 s.
- **Your stats** — a labeled bar per stat for *your own* agent. Hover a row for what it does.
- **Failure rate** and **Sanity** — live gauges with hover explainers.

## The Store

Everything costs credits and falls into four sections:

### Getting Started
Always visible — the guided path. **🔔 Push Notifications** and **🎉 Hype Banners** (pure
quality-of-life toggles, mutable per type once owned), then the app unlocks: **📟 Status Readout**,
**🏆 Trophy Case**, **📊 Install Telemetry**, **🧰 Open Inventory**, **🔧 Equip Hardware**,
**🛠 Launch the IDE**, **🌐 Go Global**.

### Team
**👥 Hire an Agent**, **🪑 <Queue> Seat** (one per owned board) and **Install <Queue>** — see
**Hiring and seats** and **Queues** above. The whole section appears once you own the Queues app.
Every board also comes with **Config sockets** (2 on the first three tiers, 3 on the last three) —
see **Configs (queue mods)** above.

### Rigs
**🖥️ Upgrade OS** — the one remaining tier ladder, and the spine of the game. See **OS gates**
below. (The old **New Machine** and **Upgrade AI Model** ladders are gone: power comes from agents
and their gear now, not from global multipliers.)

### Automation (one-time toggles)
Automation is OS-gated: **Cloud Sync needs Windows 95**, **Auto-Buyer needs Windows 10**. Locked
cards still show with a 🔒 button naming the OS.
- **🌙 Cloud Sync** — earn credits while the tab is closed (up to 8 hours away), with a
  "Welcome back" summary when you return.
- **🛒 Auto-Buyer** — automatically buys the cheapest affordable Store item every ~1.2 seconds
  (anything outside Automation — usually a seat or a hire, but it will happily buy an OS tier and
  change your look unless **Lock OS look** is on in Settings).

### Store visibility
Rigs/Automation cards — and their headers — stay **hidden** until your **peak-ever credit balance**
has reached **50% of that item's price**. Once revealed, always revealed. Getting Started items and
the IPO card are exempt.

## Gear: the four slots

Every agent has exactly four equip slots, and every slot is filled by **drops**, never bought:

| Slot | Feeds |
|---|---|
| 🤖 **Model** | Quality |
| 🧠 **Memory** | Stamina |
| ⚙️ **Compute** | Speed |
| 🧰 **Tools** | credit multiplier |

An item is `name + item level + patches`. Its name is drawn from a retro era matching your current
OS tier. If the finding agent's slot is **empty**, the item auto-equips; otherwise it goes into
**that agent's own inventory** (18 items, worst auto-scrapped for credits past the cap).

The three gear apps all act on the **selected agent** (pick one in the Agents app):

- **🔧 Equipment** — its four equipped items; **Unequip** returns one to that agent's inventory.
- **🧰 Inventory** — that agent's stash, filterable by slot and rarity. Each card can **Equip**,
  send **→ IDE**, or **Decommission** for credits + materials.
- **🛠 The IDE** — the crafting bench: one **socket** in the middle holding the item you're working
  on, with your six crafting materials ringed around it. Drag an item onto the socket (or use its
  **→ IDE** button). Each orb shows how many of that material you hold and lights up only when the
  craft is possible; hover a dark orb for why. In a very narrow window the ring flattens into a list.
  Materials are **shared across all agents**; the item in the socket belongs to whoever owns it.

## Patches & crafting

An item can carry **2–4 patches** (2 below ilvl 25, 3 below ilvl 60, 4 above). Its **rarity** is
just how many it has: **Stock** (0), **Modded** (1–2), **Custom-Built** (3–4).

| Patch | Rolls on | Effect |
|---|---|---|
| **Fine-Tuned** | Model | +15 / 30 / 60% Quality |
| **Long-Context** | Memory | +15 / 30 / 60% Stamina |
| **Overclocked** | Compute | +15 / 30 / 60% Speed |
| **Monetized** | Tools | +5 / 10 / 20% credits |
| **Sharp** | any slot | +2 / 4 / 8 Quality |
| **Snappy** | any slot | +2 / 4 / 8 Speed |
| **Resilient** | any slot | +2 / 4 / 8 Stamina |
| **Well-Rested** | any slot | +10 / 20 / 35% sanity regen |

Higher patch tiers are gated by the item's own item level, so good patches need good items.

Patches are never bought — they're applied in the IDE with a material plus a little credit. Where
each material actually comes from:

| Material | Comes from | What it does |
|---|---|---|
| 📝 Commit | any cleared **ordinary ticket** (boosted by the Open Source mod) | Add a random patch to an open slot |
| 📦 Full Rewrite | every 1,000 lines of code written | Reroll *every* patch on the item |
| 🩹 Hotfix | **bounties** | Reroll one patch's *value* |
| 🔀 Refactor Token | **bounties** | Reroll one patch's *type* |
| ⏪ Revert Commit | **bounties** (less often) | Strip the item back to Stock |
| 🔗 Feature Branch Merge | **bounties**, Jira-tier queues and up | Add a patch slot (up to 4) |

In other words: grinding ordinary tickets keeps you in Commits (and eventually a Full Rewrite), but
**Hotfix, Refactor, Revert and Merge only drop from bounties** — they're the reason bounties matter
even once you've out-geared a board's normal payout. Configs take the same materials as gear; the
only difference is which patches (mods, not stat boosts) land on them.

Only **Commit** has a soft-pity bar (every ticket that could drop it nudges the bar even when it
doesn't, so a full bar guarantees the next one) — the other five materials just show their source
line above. **Decommissioning** unwanted gear also refunds materials, so gear you don't keep still
feeds the economy.

## OS gates (Upgrade OS)

**🖥️ Upgrade OS** is the spine of the game, not a reskin. Every tier changes the look (see
**Themes**), raises the **item-level ceiling**, raises the **agent cap**, and unlocks the next
queue tier:

| OS tier | Cost | Agent cap | Item-level ceiling | Queue tier opened | Also unlocks |
|---|---|---|---|---|---|
| MS-DOS 6.22 | — | 1 | 30 | 📥 Backlog | tmux-style tiled apps |
| Windows 3.1 | $4K | 2 | 55 | 🗂 Kanban | draggable windows + Start menu |
| Windows 95 | $40K | 4 | 85 | 📋 Jira | 🌙 Cloud Sync |
| Windows 10 | $400K | 6 | 125 | 📟 PagerDuty | 🛒 Auto-Buyer |
| NEON//OS v6 | $3M | 8 | 175 | 🗺 The Roadmap | — |
| STARSHIP OS | $24M | 10 | none | 🏚 Legacy Monolith | — |

The **item-level ceiling** is the important one: drops are clamped to it, so no amount of grinding
a queue raises your gear past what your OS can run. Locked Store cards keep their price behind a
**🔒 Win 95**-style button until you own that OS. Since **IPO / Cash Out** resets your OS to
MS-DOS, every prestige run re-opens the ladder from one agent.

## Themes (Upgrade OS)

Your cockpit's look is tied to the **🖥️ Upgrade OS** purchase in Rigs, not to your level. Each
purchase advances one tier — **MS-DOS 6.22 → Windows 3.1 → Windows 95 → Windows 10 →
NEON//OS v6 → STARSHIP OS** — and immediately switches you to it. But buying a new tier doesn't
lock in that look forever: **click the OS name** (top-left, next to the logo) anytime to open a
menu of every look you've *ever* unlocked and switch back to it. Owning tier 4 doesn't cost you
the ability to display tier 1's look.

Each look also brings its own **era font**, built into the game so it looks the same on any machine:
an IBM VGA text-mode face for MS-DOS, a Windows 95-style bitmap font for Windows 3.1/95, Selawik
(a Segoe UI stand-in) for Windows 10, Share Tech Mono for NEON//OS and Oxanium for STARSHIP OS.

Layered on top of whatever look you pick is a very subtle **ambient tint** that drifts with your
local **time of day** (cool at night, warm at dawn/dusk, neutral at midday) and nudges with the
**season** — a faint mood glow at the screen's edges, not a recolor, so your OS look stays intact.

### Windows (the desktop)

Upgrade OS isn't just a reskin. On **MS-DOS** (the first tier), your apps are **tiled** — they split
the screen automatically as you unlock them (tmux-style). Each newly unlocked app **wipes open** like
a fresh tmux split, and the panes already on screen slide into their new cells to make room. The
moment you buy **Windows 3.1** (or own any later tier), the desktop **unbolts into real windows**:
- **Drag** any window by its title bar; **resize** it from the grip in its bottom-right corner.
- **Minimize / close** it (the – and ✕ in its title bar) to tuck it onto the **taskbar**.
- A **taskbar runs along the bottom** and becomes your one and only bar — the top strip folds into
  it: **⊞ Start** at the far left, then the **VIBE//HACKER** brand + OS-name (click it to switch
  looks), a button for **every app**, and a right-hand tray with **⚙ settings · ? help · your
  credits · a clock**. Click an app's taskbar button to focus it (or reopen it if minimized); click
  the focused one to minimize it back down.
- **⊞ Start** opens a Programs menu listing your unlocked apps, plus a **Reset Layout** option to
  snap everything back to defaults.

Window positions and sizes are saved, and the Start Menu / taskbar restyle themselves to match
whichever OS look you're wearing. This is desktop-only — on phones the layout stays a simple stack
whatever OS you're on. Note that **prestige resets your OS to DOS**, so cashing out drops you back to
the tiled layout until you buy your way back up to Windows 3.1.

## Prestige (IPO / Equity)

Once you've **earned $20,000** in a run, the Store's top card lets you **cash out**. This is a hard
reset — credits, OS tier, hires, seats, queues and **every agent's gear** go back to the very start — in
exchange for permanent **Equity**, worth **+2% credits, forever**, stacking with every future
cash-out.

Equity earned is `floor(√(total earned ÷ 15,000) + your highest queue tier)`. Bigger, longer runs
that reach deeper queues bank more per cash-out. Achievements, lifetime totals and your best streak
survive; only the active run resets.

This is a different thing from the stage-list "New Game+" — that's just a cosmetic lap counter for
finishing all 28 stages, with no reset. IPO is the real prestige loop.

## Achievements

20 achievements track your milestones, from "Hello, World" (clear one ticket) to "Full Floor"
(field 8 agents at once) to "Serial Founder" (cash out 5 times). They live in their own **🏆 Achievements**
app — a checklist with a running completion count — unlocked by buying **Trophy Case** from the
Store's Getting Started list. **Nothing is tracked until you buy it**; the moment you do, every
achievement you've *already* earned is granted at once (silently), and from then on new ones unlock
as you play (popping a toast if you own **Push Notifications**, and always logging to the Terminal).

Most of the list stays **hidden** until you're close: progress-based achievements (task counts,
level thresholds, streaks, etc.) only appear once you're **75% of the way there**, so the panel
doesn't open as a wall of distant goals. A few are single-trigger events with no meaningful
"75%" (Touch Grass/watching an agent go rogue, Critical Hit, IPO Day) — those stay fully hidden until the instant
you actually earn them. "Hello, World" is always visible as a first nudge.

## Saving

Your run auto-saves every few seconds to a cookie, with a `localStorage` mirror as a fallback
(cookies don't work on `file://`, which is how the mirror keeps local play working). Nothing is
sent anywhere — it's entirely local to your browser. **⟲ sudo rm -r /** at the bottom of the
**Store** app wipes it and starts over, after confirming. There's no reset during the intro terminal —
the Store appears at 10 credits, and reaching it is quick enough that waiting is fine.

## Controls

| Key / action | Effect |
|---|---|
| Mash any key / tap the screen | Drives **your own** agent; briefly surges every agent's speed |
| Click the OS name (top-left) | Switch to any unlocked look |
| `T` | Cycle through your unlocked looks |
| `?` (or the **?** button, top-right) | Show/hide the controls overlay |
| `F11` | Fullscreen — turns on the 🎧 **Deep Work** bonus (see below) |
| `Esc` / `` ` `` | Boss key — hide behind a fake spreadsheet |
| `⟲ sudo rm -r /` (bottom of the Store app) | Wipe your save and start over |

## Deep Work (the fullscreen bonus)

Play **fullscreen** and you earn **🎧 Deep Work**: **+25% credits and +50% sanity regen**,
for as long as you stay fullscreen. No browser chrome, no tabs, no distractions — the game pays you
for actually focusing.

It costs nothing and there's nothing to buy; it's a reward for how you play. A green **DEEP WORK**
pill appears at the top of the screen while it's active (click it to drop back out of fullscreen),
and the Terminal logs when it engages and when it breaks. Both routes work: `F11` browser-chrome
fullscreen *and* a real fullscreen request. Leaving fullscreen removes the bonus immediately.

## Display scaling

The interface is designed for **1920×1080**. On a bigger screen — 1440p, 4K, anything past the
reference — the whole UI **scales up** to keep text and controls at their intended size instead of
shrinking into a corner, so a 4K display shows the same tidy layout, just larger. Below 1920 the
layout stays fluid and simply fits fewer, smaller panes, down through the phone/tablet stacked view.
Nothing about this is a setting; it just follows your window.

## Settings

The **⚙ button** (top-right, next to **?**) opens a Settings panel — preferences saved with your run:
- **Number format** — how big numbers read: `1.2K` (abbreviated, default), `1,234` (full, with
  commas), or `1.2e6` (scientific past a million).
- **Reduce motion** — `System` (follow your OS setting), `Off`, or `On`. When on, it stops the matrix
  rain, skips the flying banners and screen flashes, drops the pane-spawn wipe in tiled mode, and
  near-zeroes animations.
- **Ambient time/season tint** — toggle the subtle time-of-day / seasonal glow on or off.
- **Lock OS look** — stop the **Auto-Buyer** from ever switching your OS theme on you.

## A few tips

- **Hires and seats go together.** A hire with no free seat sits on the Bench, and a seat with nobody
  in it earns nothing — the Store tells you which one you're short of.
- **Quality is the stat that gates everything else.** Below ~`0.8 × D` an agent fails so often it
  drains its own sanity and goes rogue on repeat; Speed and Tools only pay off on tickets you actually clear.
- **Gear your weakest agent first.** Income is a *sum* over agents, so a rogue or under-geared
  agent is a flat hole in your rate — not something your best agent makes up for.
- **The OS ceiling is the real wall.** When your drops all come back at the same item level, you've hit
  it: buy the next OS tier rather than grinding more.
- **Don't rush your first IPO.** Equity scales with total earnings *and* your deepest queue tier, so a
  longer first run banks more permanent bonus than cashing out the moment you can.
- **Auto-Buyer will buy an OS tier without asking** (and switch your look with it). Turn on
  **Lock OS look** in Settings if you'd rather control that yourself.
