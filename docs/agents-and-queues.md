# Agents & Queues — Design Plan

Restructure the game around two systems instead of one flat upgrade list:

1. **Desktop** — *your machine.* The OS ladder, the apps you buy (every UI element is software you
   install), task queues and their seats. Credits buy things here.
2. **Agents** — *who works for you.* A roster where every agent, including you, has the same small
   sheet: three stats, four gear slots, its own inventory, a sanity bar. **No agent levels** — all
   power is gear, and item level is the progression axis. Crafting raises things here.

Queues sit between the two: they're Desktop purchases that agents get seated in, and they carry
socketed, craftable *Configs* that make their tickets harder and richer. Bounties are timed tickets
that reward throughput. An agent whose sanity hits zero goes **rogue**.

This came out of the 2026-09-16 balance pass (see "Why" below): the current economy is one big
product of multipliers that finishes the game in about 40 minutes, and crafting is a rounding error
in it. This plan makes income a *sum of bounded agents* and makes crafting the way you raise those
bounds — which is both easier to pace and the emphasis the user asked for.

**Branch decision (user, 2026-09-17): long-lived branch `agents-and-queues` in this repo.** It merges
to `main` only when the new game is playable end-to-end, because `main` auto-deploys. This is a
save-version bump with no migration; the current game stays live on `main` until then.

## Status

**Phases 1–2 shipped on branch `agents-and-queues` (2026-09-17).** Phase 1 put the agent sheet, the
Backlog queue and the per-agent loop live: `P.agents[]`/`P.queues[]`, per-agent stats via `agentMult(a)`,
hires and seats sold in the Store, per-agent Equipment/Inventory/IDE, drops at the queue's item-level
band, and the removal of the old stat/SP, Machine, AI Model, global rig, Toolbox, Mission and
Legendary systems (`SAVE_VER` bumped, no migration). Phase 2 (`SAVE_VER 9`) added: queues as Store
purchases (Install/Seat cards generated from `QUEUE_TIERS`, gated behind the $2K Queues app and the
previous board + OS); the Queues app (one board per owned queue plus the Bench at `a.q = -1`, chips,
click-picker with per-board success/★/$-per-s and drag-to-seat, all through `seatAgent()`); the
Embezzler rogue (`ROGUE_MODES`, steals a bank fraction per second, half-speed regen, self-recovers at
50%) with Kill -9 (`8 × Σ gear ilvl`, restart at half sanity, 20 s immunity); offline earnings that skip
rogue and benched agents; `BAL` rogue knobs derived in the sim's breakeven/overreach checks; and
`validate-rate.mjs`/`--probe` accepting two-queue fixtures (`FIX.queues`/`FIX.seat`, agreement within
~2–20% at kps 0 depending on sample length). Smoke suite is 13 scenarios. **Next: Phase 3 — Configs +
bounties.**

**Whole-branch review (2026-09-17) — residuals carried forward.** Not mergeable yet *by design*
(no bounties/Configs yet). ~~Backlog named on day one via the "Backlog Seat" Store line~~ — closed in
Phase 2: the Team section is hidden until the Queues app is bought, so `isRevealed()` owns the reveal.
Pacing-table caveat: the sim assumes typing until the first hire, so the "idle" rows are
really "type until Win 3.1, then idle"; the pre-Win3.1 segment in the live game is ~13 min of typing.
Open minors (none block Phase 2 work): Store header shows a permanent `+$0/s` from the vestigial
`MULT.passive`; 5 Hz `innerHTML` rebuilds of the stash/IDE buttons can drop a click that straddles a
tick; dead `rollEls`/stale `buildToolbox` + `isRevealed` comments and unreachable `legendary` styling;
the Merge orb can never light in Phase 1 (gated on the Senior queue); `tools/smoke.mjs` doesn't await
`Page.reload` and leaks Chrome on an unknown scenario name; `aq-sim.mjs` should model the 5%×3 crit
(most of the 8–15% gap) and default `--probe` to `--craft 0`. Untested paths worth a scenario:
~~burnout → coffee break → recovery~~ (now the `rogue` scenario), prestige, unequip/decommission, IDE
craft actions on the new `craftSlot` shape, inventory cap, ~~offline earnings~~ (now `offline`).

Treat this doc as a living, resumable record (as with `crafting-update.md` and `window-manager.md`)
— the phase checkboxes are the source of truth for where to pick back up.

## Why (findings from the balance sim, 2026-09-16)

An expected-value model of the current economy (`tools/balance-sim.mjs`; its `rate()` function was
checked against the real game in headless Chrome at two states, early and late, idle and typing, and
matched to 2–15% via `tools/validate-rate.mjs`) projects — **a model projection of a greedy bot, not a
measured playthrough**:

- **The whole game is ~40 minutes.** STARSHIP OS at 22 min with light typing, 40 min pure idle.
  Costs grow ~10× per tier but income keeps pace because it's a product: Machine (×90 across the
  ladder) × item level (+2.5%/level on credits, uncapped) × surge (idle agents already run at 2.1×,
  typing pushes ~4×) × agents.
- **Machines are always the best buy** (1–3 min payback). Hires second. Nothing else competes.
- **The AI Model is never worth buying** — success saturates at the 98% cap almost immediately, and
  speed multipliers die once task duration hits the 1.1 s floor.
- **Learning a skill *lowers* income** (a fresh stat at ~9 vs the task pool), so a greedy bot never
  learns one.
- **Stats stop mattering** past stat ≈ difficulty + 9 (both success and duration are clamped), yet
  grow unbounded into the hundreds of thousands.
- **The Toolbox roll is the strongest cheap purchase** — its price (15 + 3·level) doesn't scale with
  an economy that grows 1000×, so the bot buys hundreds.
- **Crafting is a ~5% effect.** A tier-0 slot patch is +3–5%; full 4-patch gear on all 8 slots moves
  the STARSHIP time by ~30%.

Tuning the existing knobs *could* hit the user's target pace (STARSHIP ≈ 5 h; candidate "E" in the sim
got 2–4 h depending on typing/crafting), but it doesn't fix the structural problems: one dominant
ladder, dead stats, dead Model, crafting as garnish. Hence the restructure.

## The two systems

### Desktop — your machine

Everything on the Desktop side is **software you install on your rig**, bought with credits, the
same way the OS is bought today. The existing OS ladder (`OS_TIERS`) stays the milestone spine.

- **OS tier** gates: which apps/queues are purchasable, the **item-level cap** (`ILVL_CAP`, as
  today), number of agent seats overall, and (as today) the window paradigm and theme.
- **Apps** — the current purchase-gated windows (Status, Telemetry, Toolbox, Equipment, IDE, Globe,
  Achievements) plus two new ones: **Agents** (the whole roster + the selected agent's sheet) and
  **Queues** (every board and its seats; drag agents between them). Missions app is **removed** (see
  Bounties). Queues are *not* individual windows — they all live in the Queues app (user, 2026-09-16).
- **Queues** — see below. Bought like apps; each has a fixed base tier.
- **Hires and seats are separate.** *Hire* is its own Store line (cost scales with headcount; a new
  agent ships with a Junior starter kit); *seats* are per-queue capacity bought separately; the OS caps
  total hires.
- **Countermeasures** — Guardrails, Alignment, … : levelled defensive software against rogue agents
  (see Rogue agents).
- **Personal rig slots** — *decided against.* The player is agent zero with the same four gear slots
  as everyone else; there is no separate global Machine/Model ladder. The global multipliers that
  the Machine ladder provided are gone on purpose (they're what made the economy a runaway product).

### Agents — who works for you

Every agent, **including "you" (agent zero, the manual worker)**, has the same sheet:

| | |
|---|---|
| **Level** | **None.** (Decided 2026-09-16: agents don't level; item level is the axis.) A global *player* level survives only as flavour — titles, story stages, achievements, Equity — and feeds no stats. |
| **Stats (3)** | **Speed** — task duration. **Quality** — success chance and crit. **Stamina** — sanity pool and regen. Each stat = a **flat floor** (≈10, same for every agent, so a naked agent can hold Junior) **+ gear** (item level × slot coefficient + patches). No skill points, no allocation, nothing per-agent except what's socketed. |
| **Slots (4)** | **Model** (→ Quality; the GPT-2 → AGI ladder becomes drops/crafting, not a Store tier). **Memory** (→ Stamina; context window as RAM). **Compute** (→ Speed; CPU/GPU flavour). **Tools** (wildcard: credits, XP, drop rate, misc). |
| **Inventory** | Per-agent stash of candidate items for its slots; the IDE bench crafts against whichever agent is selected. A **new hire comes with one Junior-band item per slot** so it isn't useless. |
| **Sanity** | Drained by failed tickets (scaled by ticket difficulty), regenerated by Stamina. Zero ⇒ **rogue**. |

Replaces: the 5 stats (`STATS`), skill points/`Learn a New Skill`, the 8 global slots (`SLOTS`),
the shared Toolbox, and the `computer`/`model` tier upgrades. Patches roll on the slot's stat first,
plus generics, as today; `PATCH_DEFS` is rewritten for the new slots but keeps its shape.

**Item level rules (mostly already in the code):**
- **Ilvl comes from where the item dropped**, not from who dropped it: a queue's tier sets the ilvl
  band of its drops and bounties (PoE map level). Queue tier is therefore the progression axis.
- **Bands must overlap (the gear-wall rule).** Queue N's drop band, fully patched, must reach the stats
  queue N+1 requires at ≥90% success — otherwise a player farms a queue that can never gear them past it,
  and with a 0% success floor that is a hard dead-end. Config mods therefore include **+ilvl** (raise the
  drop band), not just quantity/rarity. The sim proves this for every adjacent pair before Phase 2.
- **The OS caps ilvl** (`ILVL_CAP[P.up.os]`, unchanged pattern).
- **Ilvl gates mod count and mod tier**: low-ilvl items hold one or two weak mods; high-ilvl items hold
  up to four and can roll the top tiers (`initialMaxPatches` + the per-patch `gate` arrays, as today —
  retune the thresholds to the new bands).

**The player as agent zero.** Typing is the *only* thing that drives your own task (mashCode) — agent
zero earns nothing idle, as today, and Autocomplete Assist is gone (user, 2026-09-17). Idle income is
purely hired agents. Typing still bumps surge for everyone (pair-programming flavour), but the surge
multiplier is much smaller than today so typing is a bonus, not a 4× lever. Your sanity hitting zero = you go rogue too
(today's burnout, same recovery rules as any agent).

## Queues

A queue is a **Desktop purchase** with a **fixed base difficulty tier** and a number of **seats**.
Day one you have one Junior queue with one seat (you) — **it has no UI of its own**: agent zero just
works tickets in the terminal, and the queue concept only becomes visible when you buy the Queues app
(user, 2026-09-17). Each further queue is a harder board inside the Queues app, with its own flavour:

| Queue (a board inside the Queues app) | Tier | Flavour |
|---|---|---|
| Backlog (invisible until the Queues app) | Junior | where you start |
| Kanban | Mid | sticky notes |
| Jira | Senior | the board fills itself |
| PagerDuty | Staff | incidents, on-call |
| The Roadmap | Principal | quarterly OKRs |
| Red Team | special | seats agents who handle rogue agents instead of tickets (see Rogue agents) |
| (later tiers as OS tiers unlock) | | |

- **Difficulty is player-chosen by seating.** The base tier sets a fixed difficulty band; the
  agent's stats vs. that band decide success. Story stages (`STAGES`) stay as flavour/pacing and stop
  driving difficulty.
- **Reward grows faster than difficulty** (payout ∝ difficulty^k, k≈1.5 — *a tuning parameter, not a
  law*). Success = clamp(0.5 + (stat − difficulty)·0.05, **0**, 0.95): no success floor, so overreaching
  by 10+ points is 0%. Duration keeps both the floor (1.1 s) and the ceiling (16 s). Review (2026-09-16)
  showed payout alone does *not* produce "peak just above the band" — for weak agents the raw-credit
  optimum sits well into overreach — so **sanity is the explicit governor**: every failed ticket drains
  difficulty·c, every ticket (even a success) drains a workload cost difficulty·c/10, regen comes from
  Stamina and must be pinned so drain/regen ≈ 1 at the intended queue for that gear level. The sim must
  demonstrate that Mid at 95% beats Principal at 20% *including* rogue downtime before numbers are final.
- **Seats are upgradable per queue**, replacing the flat hire cap. OS tier caps hires; a single queue can't
  have more seats than that cap (Phase 2 decision — see §1 there).
- **Assignment is the management game.** Drag agents between queues; the picker shows each agent's
  expected success chance per queue so the choice is informed. An Automation purchase can later
  auto-seat everyone at their best queue (same shape as today's Auto-Buyer).
- **Failure has to cost.** Failed tickets drain the agent's sanity; enough of them ⇒ rogue. Parking
  everyone on Principal at 20% must be clearly worse than Mid at 95%.

### Queue Configs (mods)

Each queue has **2–3 Config slots**. A Config is an **item** — it drops, has an item level, rolls
patches, and goes through the same IDE bench and materials as agent gear. Its patches are **mods**
that make the queue's tickets **harder *and* more valuable**: difficulty adds, payout multiplies.
Path of Exile map mods, essentially; today's mission "Sprint Config" is the prototype.

| Mod | Effect |
|---|---|
| Legacy Codebase | +difficulty, +credits |
| On-Call Rotation | failures drain double sanity, +drop rate |
| Crunch | faster tickets, passive sanity drain while seated |
| Open Source | −credits, +XP, +materials |
| Enterprise Client | ++difficulty, ++credits |
| Favoured stat (from missions) | tickets lean on one stat |

The core loop this creates: raise an agent until it qualifies for a queue, then mod the queue until
the agent barely qualifies again. Materials get a second sink so they stay valuable late.

### Bounties (replaces the Mission Board)

A bounty is a **timed special ticket** that lands in a queue with a countdown. It pays only if an
agent picks it up **and** clears it before the clock runs out — slow throughput, a clogged queue,
or a failed attempt means it expires unrewarded (no penalty; the expiry shows in the log so the
player learns queues can be too slow). This is the throughput reward that nothing provides today.

- Bounty size and rarity scale with the queue's tier and mods — juiced queues are where good drops live.
- **Offline bounties are a purchase.** By default bounties only spawn while the tab is foregrounded and
  their clocks pause otherwise. An Automation item (*Pager Integration*, next to Cloud Sync) enables
  bounties to spawn and resolve while away, at whatever efficiency the sim says is fair.
- **Bounties are the crafting economy's main faucet**: materials, gear, Configs, the odd Legendary.
  Ordinary tickets give a trickle.
- The Missions app, `MISSION_DEFS`, `progressMissions`, favoured stats, Sprint Config all go away
  (favoured-stat and Sprint Config return as queue mods/Configs).

## Rogue agents (replaces burnout) — and Countermeasures

Sanity hits zero ⇒ the agent **goes rogue**: it stops earning and starts doing damage until dealt
with. (User, 2026-09-17: rogue is a real subsystem with *types*, *escalation*, and a *countermeasures*
ladder you have to keep up — not a single timeout.)

- **Rogue types (bad modes).** A rogue agent starts with one mode and, **left unattended without the
  proper countermeasures, gains more over time**:
  - *Embezzler* — steals a % of current credits per tick (never below zero).
  - *Blocker* — clogs its queue with no-pay Incident tickets; bounties there expire.
  - *Debt-farmer* — spawns Tech Debt tickets that fill the queue and must be cleared before real work.
  - *Contagion* — drains the sanity of other agents in the same queue, so they go rogue too.
  - (more as flavour allows; each is a row in a `ROGUE_MODES` table with a tick effect and an
    escalation weight)
- **Countermeasures are Desktop software you level up.** *Guardrails* and *Alignment* (plus later
  tiers) are Store purchases with levels, OS-gated like Automation. They (a) slow escalation, (b)
  auto-contain specific modes (Guardrails stop Contagion, Alignment stops Embezzler…), and (c) cut
  Kill -9's cost. Under-invested countermeasures are how an ignored rogue snowballs.
- **Recovery.** *Kill -9*: instant, costs credits scaled to the agent's total gear ilvl (reduced by
  countermeasure level), agent returns at half sanity with a short immunity. Or wait: sanity regenerates
  slowly and it recovers on its own — cheaper, but modes keep escalating meanwhile. An Automation
  purchase can auto-Kill -9.
- **A rogue can be dragged out of its queue** to protect the others, but keeps its non-queue modes
  (Embezzler) until recovered.
- **The Red Team** (user, 2026-09-17). A special queue you buy, whose tickets are *rogue agents*.
  Agents seated there earn nothing; instead, when an agent goes rogue, a Red Team agent picks it up
  and rolls a **contest**: Red Team agent's stats vs the rogue's gear power (plus its accumulated
  modes). Win ⇒ the rogue is contained/recovered without Kill -9. Lose ⇒ the Red Team agent takes a
  sanity hit scaled to the gap — **and can go rogue itself**, since a rogue that outgears the team is
  stronger than the team. So the Red Team must be kept geared to the level of your best agents, not
  parked with cast-offs. Countermeasure software levels add to the Red Team's roll; the Red Team is
  the *manual* alternative to auto-Kill -9, and cheaper in credits but not in seats or gear.
  A Red Team with nobody seated behaves as if it weren't bought.
- **Applies to agent zero** — the player going rogue is today's burnout with better flavour.

Makes Stamina and the Memory slot matter, makes overreaching on queue tier a real risk, and gives
the Desktop side a defensive purchase ladder next to the offensive one (queues/seats).

## What carries over unchanged

Prestige/Equity (IPO), Deep Work (fullscreen bonus), the OS ladder and themes, the window manager,
materials (`MATS`), telemetry, the globe, the number-format and notification settings.

**Carries over but must be reworked** (not "unchanged"): the IDE bench ring (`CRAFT_ACTIONS` keeps its
shape, but targets the selected agent's item *or* a queue Config, so the slot predicate and patch pool
become polymorphic); achievements (`ACH` reads `P.up.computer/model/hire` today — rewrite in Phase 1,
not Phase 4); Deep Work (applies to every seated agent, not just agent zero); prestige — **resets everything**
(credits, OS, queues, seats, hires, gear, Configs) and Equity = sqrt(total earned) + highest queue tier
reached, no longer level-based; stages — **story only**: the stage-up full heal and XP multiplier go
away, and the Merge material unlocks on reaching the Senior queue instead of `P.level>=40`.

## What is removed

`STATS`/skill points/`Learn a New Skill`; `SLOTS` (8 global slots) and the shared `P.equip`/
`P.toolbox`; `MACH`/`computer` and `MODEL`/`model` tiers; `HIRE`/`HIRE_CAP` (seats replace them);
the Mission Board (`MISSION_DEFS`, Missions app, Sprint Config); burnout as a global event; the
Espresso Machine and Autocomplete Assist repeatables (Stamina/Memory and Compute cover them — or
they survive as Tools-slot flavour items, decide in Phase 2). `SAVE_VER` bumps; no migration.

## Balance model — derived skeleton (2026-09-17, `tools/aq-sim.mjs`)

`tools/aq-sim.mjs` is the expected-value model of *this* design (the old `balance-sim.mjs` models the
current game and stays for reference). It runs the design-rule checks (`--checks`) and a greedy
playthrough bot (hire/seat/queue/OS purchases by shortest time-to-afford + payback; agents reseated
to their best queue; Configs set to the most every seated agent can run at ≥90%). These are the
**starting numbers for Phase 1**, not final tuning — re-validate in headless Chrome once playable.

**Formulas (all knobs in the `T` table at the top of the sim):**

| | |
|---|---|
| Agent stat | `10 + ilvl_slot × 1.0 × (1 + craft × 0.6)` — Model→Quality, Memory→Stamina, Compute→Speed; Tools = `1 + 0.004·ilvl` credit mult. `craft` ∈ [0,1] = how fully patched the gear is. |
| Success | `clamp(0.5 + (Quality/D − 1) × 1.25, 0, 0.95)` — **relative** gap (95% at Q = 1.36·D, 0% at Q = 0.6·D), so every tier feels the same. No floor. |
| Duration | `clamp((4 + 0.3·D) / (1 + Speed/40), 1.1, 16) / (1 + 0.15·surge)` + 0.7 s cooldown. Surge from typing is small on purpose. |
| Payout | `D^1.5 × 1.15^mods × tools` |
| Sanity | drain/ticket = `D × 0.3 × (0.1 + 3·(1 − success))`; regen = `0.02 × Stamina`/s. Rogue when drain > regen: uptime = regen/drain, halved again by incidents. |
| Queues | Backlog D10 → Kanban 25 → Jira 45 → PagerDuty 70 → The Roadmap 100 → Legacy Monolith 140, one per OS tier. Each Config mod: D ×(1+0.12·n), payout ×1.15ⁿ, drop band ×(1+0.12·n). Max 3 (unlimited on Legacy Monolith — not yet modelled). |
| Drops | 10% per success; ilvl uniform in [tier D, **0.92 × next tier's D**] × mod bonus, capped by `ILVL_CAP = [30,55,85,125,175,∞]`. Band top deliberately sits *below* the next tier so uncrafted gear alone lands at ~50–70% there and crafting is what gets you to 95%. |
| Hires / seats | hire #n = `150 × 3.2ⁿ⁻¹`; seat n on a tier-t queue = `150 × 2.2ⁿ⁻¹ × 4ᵗ`; hire cap per OS `[1,2,4,6,8,10]`; starter kit ilvl 10. |
| Costs | OS `[0, 4K, 40K, 400K, 3M, 24M]`; queues `[0, 2K, 20K, 200K, 2M, 15M]`. **Rederived from the sim**, not the old tables. |

**Design-rule checks pass:** every adjacent tier pair is reachable at 95% with crafted band-top gear
(gear-wall rule), and for every gear level the income-maximising tier has ≥85% success — overreach
never pays, because sanity drain (not a success floor) governs.

**Pacing (time to each OS tier; kps = keypresses/sec, craft = fraction of gear fully patched):**

| Scenario | Win3.1 | Win95 | Win10 | NEON | STARSHIP |
|---|---|---|---|---|---|
| **Reference: light typing, half-crafted** (kps 2, craft 0.5) | 5m | 17m | 42m | 1h45 | **5h06** |
| idle, half-crafted (kps 0, craft 0.5) | 5m | 24m | 59m | 2h31 | 7h11 |
| light typing, fully crafted (kps 2, craft 1) | 5m | 14m | 32m | 1h10 | 2h52 |
| idle, fully crafted (kps 0, craft 1) | 5m | 21m | 48m | 1h35 | 3h34 |
| heavy typing, fully crafted (kps 5, craft 1) | 2m | 8m | 22m | 50m | 2h10 |
| light typing, **no crafting** (kps 2, craft 0) | 5m | 21m | 1h06 | 5h16 | never (walls at PagerDuty) |

So: STARSHIP ≈ 5 h for the reference player ✓; full crafting is ~1.8× faster than half ✓ (target
~2×); pure idle is viable at ~1.4× slower ✓; heavy typing is a ~1.3× bonus, not 4× ✓; zero crafting
walls, which is the intended emphasis (a real player always crafts *some*).

**Known model limits / follow-ups:** bounties, Red Team, rogue *types*, countermeasures and offline
bounties aren't modelled (rogue is just uptime loss). The bot sometimes shows a negative Δ for a
seat because Configs are set to the *weakest* seated agent's safe level — a real player would keep
weaker agents off a juiced queue. Legacy Monolith's unlimited mods aren't modelled, so it looks
unattractive (73 h payback) — fix when modelling the endgame. `validate-rate.mjs` was re-specified for
the new state shape in Phase 1 and agrees with `aq-sim.mjs --probe` within 8–15% at kps 0.

Also note: the **Mission Board, Legendaries and the Toolbox roll were removed in Phase 1**, not Phase 3
as planned — their code read the deleted stat/global-rig systems, so they could not survive the Phase 1
removals. Until bounties exist (Phase 3) materials come from ordinary cleared tickets, so the material
faucet is thinner than the model's endgame assumes.

## Phased delivery

### Phase 1 — Agent sheet + queue skeleton
- [x] Branch decision recorded above (`agents-and-queues`, created 2026-09-17).
- [x] `AGENT` table + `P.agents[]` (3 stats, 4 slots, inventory, sanity — no level); agent zero = player; hires ship with a Junior starter kit.
- [x] One queue (Terminal, Junior, 1 seat) driving `assignTask`/`resolveTask` from agent stats vs. tier band.
- [x] `recompute()` becomes per-agent: `MULT` becomes a per-agent struct (`agent.mult`); the few global consumers (telemetry totals, offline earnings) sum over seated agents.
- [x] Remove `STATS`/SP, `MACH`, `MODEL`, global `SLOTS`/`equip`/`toolbox`. `SAVE_VER` bump. Rewrite `ACH` at the same time (it reads removed fields).
- [x] Minimal drop source: ordinary tickets drop items at the queue's ilvl band (so Phase 1 has progression to tune).
- [x] Agents app shows the roster with sheets; Equipment/Inventory/IDE operate on the selected agent.
- [x] Sim `rate()` rewritten; first pacing pass. Validator re-specified for the new state shape.

### Phase 2 — Queues as purchases
- [x] Queue table (tier band, seats, cost, OS gate); Queues app; Store sells queues and seats.
- [x] Drag-to-seat UI with per-queue expected-success readout; OS caps ilvl and hires; drops/bounties roll ilvl from queue tier.
- [x] Payout curve, sanity drain on failure; rogue state (single mode) + Kill -9 + auto-recover.
- [x] Hire line (with starter kit) separate from seats; OS caps hires.

### Phase 3 — Queue Configs + bounties
- [ ] Config item type, 2–3 slots per queue, mod `PATCH_DEFS`; IDE bench crafts them.
- [ ] Bounty tickets (timer, scaling, rewards); remove the Mission Board.
- [ ] Materials/drops rebalanced so bounties are the main faucet.

### Phase 4 — Automation, polish, docs
- [ ] Auto-seat, auto-Kill -9 and offline-bounty (Pager Integration) Automation purchases (OS-gated like today's).
- [ ] Rogue types (`ROGUE_MODES`), escalation, Countermeasures ladder (Guardrails, Alignment).
- [ ] Red Team queue: contest roll vs rogue power, sanity hit on loss, Red Team agents can go rogue.
- [ ] Achievements rewritten; Telemetry per-queue.
- [ ] `guide.md`/`README.md` rewritten for the new systems; `CLAUDE.md` architecture section updated.
- [ ] Full pacing pass against the targets above; validate in headless Chrome.

## Phase 2 design (2026-09-17) — queues as purchases, seating, rogue

Brainstormed with the user 2026-09-17; the decisions below are settled, the numbers are the sim's
job. Scope is exactly the Phase 2 checklist above plus the Phase 1 residuals it naturally covers
(burnout → recovery test, Backlog reveal). Bounties, Configs, rogue *types*, countermeasures and the
Red Team stay in Phases 3–4.

**Decisions (user):** Queues app is a Getting Started Store unlock (`u_queues`, $2K) — not free with
Win 3.1 or the first hire. Seating is click-to-seat (a picker with per-queue success readout) as the
source of truth, with drag-and-drop as sugar on the same code path. The single Phase 2 rogue mode is
**Embezzler**. A **Bench** exists (`a.q = -1`) — hires no longer need a free seat. Queues and seats
are sold in the Store as cards generated from `QUEUE_TIERS` (not inside the Queues app).

### §1 State & Store

- `P.queues[]` keeps its shape (`{tier, seats, mods, configs}`), one entry per owned tier, in tier
  order (you can only install the next tier). `a.q = -1` is the Bench: no tickets, full-rate sanity
  regen. **Every `P.queues[a.q] || P.queues[0]` fallback goes** — they would silently make the Bench
  the Backlog. A `seatedQueue(a)` helper returns `null` for the Bench and each consumer branches:
  `workerQueue`/`assignTask` (no ticket; `tickWorker` still regens, then returns before assignment),
  `renderAgentSheets` ("Bench"), `offlineEarnings` (skipped), `mashCode` (typing does nothing while
  agent zero is benched), the Store's `freeSeatQueue`. `P.up.u_queues` / `P.unlocked.queues` like every
  other app unlock.
- New `BAL` keys, mirrored 1:1 in `tools/aq-sim.mjs`: `queueCost` (`[0,2000,20000,200000,2e6,15e6]`
  from the sim), `rogueSteal` (Embezzler fraction of current credits per second), `kill9PerIlvl`
  (Kill -9 cost per point of the agent's summed gear ilvl), `rogueRegen` (sanity regen multiplier
  while rogue, < 1), `rogueImmune` (seconds of immunity after Kill -9).
- Store cards come from tables, with the full card schema the Store already expects (`id, kind, tier,
  cat:"Team", emoji, name, fx`): `QUEUE_TIERS.slice(1)` → `{id:"q_"+t.id, kind:"queue", tier}` (needs
  the previous tier owned, `osLock` on `t.os`, shows 🔒 like any OS-gated card); every tier →
  `{id:"seat_"+t.id, kind:"seat", tier}` visible only once that queue is owned. Both are `Team` cards,
  so the `u_queues` gate below covers them too. This replaces the
  hardcoded "Backlog Seat" line. Seat cost = `seatCost(q)`; per-queue seat cap = `HIRE_CAP[os]` (the
  existing day-one guard, kept; hires are what the OS caps — a queue merely can't out-seat the cap).
  `upCost`/`osLock`/`buy` gain a `queue` branch; the `seat` branch reads `u.tier`, and `renderStore`'s
  hardcoded `P.queues[0].seats` becomes per-tier. **The cards are generated once at load** (`UPG =
  [...base, ...QUEUE_TIERS.flatMap(...)]`) so `buildShop()` stays build-once; *visibility* is the moving
  part, via `isRevealed`: `Team` cards need `P.unlocked.queues` (replacing today's unconditional `Team`
  clause), `seat_X` needs queue X owned, `q_X` needs queue X−1 owned (then `osLock` shows 🔒 as usual).
  An owned queue's `q_X` card reads OWNED; an unrevealed one is hidden, never OWNED.
- `u_queues` ($2000, "Open the Queues app") is the reveal: Hire and Seat cards are hidden until it is
  owned (nothing lost — hires are impossible before Win 3.1 at $4K anyway). Before it, agent tiles
  drop the queue name so the Backlog stays nameless on day one; after, they show "Seated: …".
- Hire lands on `freeSeatQueue()` else the Bench; the "needs a free seat" copy goes.
- Auto-Buyer candidate set (replacing today's hire/seat/OS loop): **hire** if a free seat exists and
  the OS cap allows; **a seat** (cheapest across owned queues) only when *no* seat is free — so it never
  buys a seat nobody can sit in; the **next queue** if revealed and not OS-locked; the **OS** upgrade as
  today. Every candidate must pass `isRevealed` (today's loop walks `UPG` blindly). Cheapest
  affordable wins. Generated cards are in `UPG`, so the loop needs no second list.
- `SAVE_VER` bumps (`a.q` semantics and the new `a.rogue` field). No migration.

### §2 Queues app & seating

- `APPS` gains `queues` (`queuesPanel`, `order: 8`, `unlocked: () => !!P.unlocked.queues`) with a `WIN_LAYOUT`
  slot carved from the `agents` column (`deploy_mesh` and `achievements` drop to 1 half-row each,
  `queues` takes 2; the column still totals `WIN_ROWS`). Tiled mode picks it up from the pane order.
- Layout: one **board** per owned queue plus a **Bench** board last. Board header: emoji, name,
  tier D, `seated/seats`, the drop ilvl band (`[D, queueBandTop(q)]`). Body: one **chip** per seated
  agent — colour dot, name, success ★ + %, mini sanity bar, `☠ ROGUE` badge — and dashed
  placeholders for empty seats.
- Click-to-seat: clicking a chip opens an inline picker listing every owned queue + Bench with that
  agent's success %, ★ and expected $/s there (from `a.m.chance/payout/dur`); full boards are greyed
  "no free seat". Choosing calls **`seatAgent(a, qi)`** — the single mutation point: validates
  capacity, sets `a.q`, aborts the in-flight ticket, `recompute()`, rebuilds, `save()`.
- Drag: pointer-event drag of chips between boards, dropping into `seatAgent()`; targets highlight
  only with a free seat; rect math divides by `uiZoom` as the window drag code does.
- Build-once / update-on-timer: `buildQueues()` on structural change (buy, hire, seat, rogue
  transitions), `renderQueues()` at 5 Hz for %, sanity and Kill -9 affordability.

### §3 Rogue (Embezzler) + Kill -9

- `burnout(a)` becomes `goRogue(a)`: sets `a.rogue = {mode:"embezzler", t:0, stolen:0}` (`t` = seconds
  rogue so far, not a wall-clock stamp) — **persisted**, replacing the runtime-only `a.down`.
  `P.burnouts` → `P.rogues` (the "Touch Grass" achievement copy follows); `P.rogues` and `P.stolen`
  join `doPrestige`'s `keep` list as lifetime counters. `a.immune` (seconds left) is runtime-only and
  is stripped in `save()` alongside `a.m` (the strip list is `{m, immune}` — `down` is gone).
- `ROGUE_MODES` is created now with the single Embezzler row `{id, lbl, em, desc, tick(a,dt)}` so
  Phase 4 adds rows, not branches. Embezzler tick: `P.credits -= P.credits × rogueSteal × dt`, never
  below 0, accumulated on `a.rogue.stolen` and `P.stolen` (persisted lifetime counter for Status).
  **Call site:** the top of `tickWorker` (after regen, before the Bench/ticket branches) — so it runs
  for benched rogues too, freezes with the boss-key pause like everything else, and **does not run
  offline**: `offlineEarnings` skips rogue and benched agents, and a rogue neither steals nor recovers
  while the tab is closed (same "paused while away" rule the spec uses for bounties).
- While rogue: no tickets; sanity regens at `rogueRegen ×` normal — applied **at the tick site**
  (`a.m.regen × (a.rogue ? BAL.rogueRegen : 1)`), not baked into `agentMult`, so no `recompute()` is
  needed on the transitions; auto-recovers at 50 % of `sanityMax`, clearing `a.rogue`. Agent zero follows the same rules (typing does nothing while rogue).
- Kill -9: button on the rogue's chip and Agents-app tile, cost `kill9Cost(a) = kill9PerIlvl × Σ gear
  ilvl` (empty slots count 0 — `unequipSlot` leaves `null`) on the label. Pays → `a.rogue = null`, `a.sanity = 0.5·sanityMax`, `a.immune = rogueImmune`
  (sanity can't drop below 1 while immune). Unaffordable → shake + toast, no change.
- Benching a rogue is allowed (`seatAgent(a,-1)`); it has no effect on Embezzler but is the path
  Phase 4's queue-bound modes will use.
- Terminal/HUD: a rogue line on transition (`☠ Dave went ROGUE — embezzling $X/s`), a drip line
  throttled to ~10 s, chips/tiles turn red.

### §4 Balance, verification, docs

- Sim first: `aq-sim.mjs` replaces its `rogueTax` uptime penalty with the Embezzler as designed. Since
  the steal is a fraction of the *bank*, the target is stated in bank terms: a full unattended rogue
  (auto-recovery time `T` from `rogueRegen` × Stamina regen) loses `1 − e^(−rogueSteal·T)` ≈ **25 % of
  banked credits at endgame Stamina** (`T` shrinks with Stamina, so a single `rogueSteal` calibrated
  there costs naked agents more — ~45 % — which is the intended "low Stamina hurts" signal, not an
  invariant), and `kill9PerIlvl` is set so Kill -9 beats waiting whenever the bank exceeds ~4 ×
  `kill9Cost` — i.e. a player saving for the next OS/queue always kills, a broke one waits. "Spend the
  bank down" is not an exploit but the intended other answer. **Both checks stay analytic — no
  per-agent state machine in the bot:** breakeven is the inequality `bank·(1 − e^(−s·T)) ≥ kill9Cost`
  at `bank = 4·kill9Cost` over a gear sweep; overreach is a *rate*: when drain > regen an agent cycles
  (time-to-zero = sanity / (drain − regen), then Kill -9 and a restart at half sanity), so its income
  is `credits/s × uptime − kill9Cost / cycle`, and the check is that this is below the safe tier's
  income for every gear level. The sim also learns `a.q = -1` (Bench: zero rate, excluded from
  `optimiseSeating`). Numbers land in `BAL` only after `--checks` passes.
- `tools/smoke.mjs` scenarios added: `queuesApp`, `buyQueue`, `seatAgent`, `rogue` (covers the Phase 1
  residual burnout → recovery path), `bench`, `offline` (a closed-tab window with a rogue and a benched
  agent earns only from the seated, sane ones). Existing scenarios change deliberately, not silently:
  `stateShape`'s `ver` follows the bump; `storeHire`/`seatGate` fixtures gain `u_queues`; and
  `storeHire`'s "hire blocked without a free seat" assertion inverts to "hire lands on the Bench". `validate-rate.mjs` fixtures gain
  `queues`/seating so a two-queue state can be checked against `--probe`.
- Docs in the same work: `guide.md` (Queues app, seating, Bench, rogue/Kill -9), `README.md` blurb,
  `CLAUDE.md` (architecture bullets for `seatAgent`, `ROGUE_MODES`, `a.rogue`; the smoke list), this
  doc's Status line and Phase 2 checkboxes.

## Review findings (adversarial review, 2026-09-16) — what changed and what's still open

Cross-model review (DeepSeek reviewer, two rounds). Fixed in place above: the EV-has-no-peak flaw
(B1: sanity is now the governor, success has no floor, payout exponent is a tunable), the gear-wall
rule (B2), the "validated" overclaim (B3), Kill -9 priced off ilvl (M1), `CRAFT_ACTIONS`/`ACH`/Deep
Work/prestige moved out of "unchanged" (M5), `MULT` decided per-agent (M7), drops pulled into Phase 1
(M6), the tier-spacing and patch-slot wording. The eight open questions the review left were **decided by the user on 2026-09-17** — see the
Decisions log below.

## Decisions log (2026-09-17, user answers to the review's open questions)

| Question | Decision |
|---|---|
| Hire vs seat | Separate: hire = roster line with starter kit; seats = per-queue capacity; OS caps hires. |
| Bounties while away | Paused by default; **purchasable** offline bounties (Automation item). |
| Prestige | Resets everything; Equity from sqrt(total earned) + top queue tier. |
| Success cap vs ceiling | 0.95 cap; Config mods stack without limit; final OS unlocks an uncapped endgame queue. |
| Rogue | Full subsystem: rogue *types*, escalation when unattended, **Countermeasures** ladder (Guardrails, Alignment…), Kill -9 with immunity, draggable out of queue, and a **Red Team** queue whose agents fight rogues in a stat contest and can themselves go rogue if outgeared. |
| Day-one queue | Invisible until the Queues app is bought; agent zero just works in the terminal. |
| Stages / level | Story only; drop the heal + XP multiplier; Merge gate → Senior queue. |
| Agent zero idle | Earns nothing idle; typing only; Assist removed. |

## Still open (to be settled by the sim, not by decision)
- ~~Stat floor, gear coefficients, payout exponent, sanity constants, tiers, cost ladder~~ — derived, see
  "Balance model". Still to model: bounties, Red Team, rogue types, Legacy Monolith's unlimited mods.
- Three stats confirmed enough? (A fourth, player-only stat fed by typing was floated and parked.)
- Keep the global player level as flavour (assumed yes: titles, achievements).
- `ROGUE_MODES` numbers and countermeasure tiers.

## Backlog absorbed
From `todo.md` once this ships: agent personalities/specializations (per-agent stats + gear *are*
this), training-data → train your own model (becomes Model-slot crafting), buffs/debuffs with
durations (queue mods), "beat the game" endgame trigger (last OS tier still), economy rebalance
(W5) — the sim findings above supersede "once there's playtest data" with a model, though real
playtest data is still wanted once Phase 2 is playable.
