# Agents & Queues — Phase 3 (Configs, bounties, faucets) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Queue Configs (craftable items whose single-stat mods juice a queue) socketed from agent inventories into the Queues app boards, and timed bounty tickets that the next free agent picks up and that become the crafting economy's faucet (materials bundles, gear, Configs), with ordinary tickets trimmed to credits + Commits.

**Architecture:** Everything lives in `index.html`'s single IIFE, driven by tables: five `PATCH_DEFS` rows with `slot:"config"` are the mods; `queueMods(q)` derives a `{d,pay,band,speed,mats}` vector from the Configs socketed in `q.configs` and replaces the old integer `q.mods`; `QUEUE_TIERS[].slots` sizes the sockets; `BOUNTY_NAMES`/`BAL.bountyRewards` drive bounties, whose pickup is *derived* from the workers (`bountyWorked(q)`), never stored. Balance numbers are derived in `tools/aq-sim.mjs` first and mirrored into `BAL`. Verification is `tools/smoke.mjs` scenarios (headless Chrome) — there is no unit-test framework.

**Tech Stack:** Vanilla HTML/CSS/JS (no build), Node 20+ for the harnesses, headless `google-chrome` via CDP.

**Spec:** `docs/agents-and-queues.md` — section "Phase 3 design (2026-09-17)" (§1–§4) is what this plan implements; "Queue Configs (mods)" and "Bounties" above it are the original intent it refines.

## Global Constraints

- **No save migrations.** Any save-shape change bumps `SAVE_VER` (9 → **10** in this plan); old saves hit Guru Meditation. Never write backfill code.
- **`BAL` ↔ `tools/aq-sim.mjs` `T` stay mirrored 1:1.** A number changes in both or neither. Task 1 derives; Task 2 mirrors.
- **`a.m` and `a.immune` are runtime-only** (stripped in `save()`); `w.task` (incl. `w.task.bounty`) is worker-runtime. **Never store "who is working the bounty"** — derive it with `bountyWorked(q)`.
- **`seatedQueue(a)` returns `null` on the Bench; never fall back to `P.queues[0]`.**
- **`q.mods` (integer) is deleted.** Every consumer reads `queueMods(q)`. `grep -n "\.mods" index.html tools/*.mjs` must show only `queueMods`/`m.mods`-style vector reads when Task 2 is done.
- **Data-driven tables, not scattered conditionals** (`CLAUDE.md`): mods are `PATCH_DEFS` rows, bounty rewards are a weight table, socket counts are a `QUEUE_TIERS` column.
- **Docs are part of done:** `guide.md`, `README.md`, `CLAUDE.md`, and the spec's `## Status` + Phase 3 checkboxes are updated inside this plan (Task 7), not later.
- **Verification command** (run before calling any task done — ~18 min):
  `for s in boots stateShape loopEarns storeHire seatGate noOldSystems perAgentGear queuesApp buyQueue seatAgent dragSeat bench rogue offline configs faucets bounty; do node tools/smoke.mjs $s || break; done`
  (scenarios that don't exist yet are added by the task that needs them — until then run the ones that do).
- **Never commit unless the step says to.** Commit messages are detailed, written for `git log` readers with zero context, and end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- Branch: `agents-and-queues`. Do not merge to `main`.

---

## File map

| File | Responsibility in this plan |
|---|---|
| `index.html` | Game. Tables (`BAL` keys, `QUEUE_TIERS.slots`, `CONFIG_SLOT`, `CONFIG_NAMES`, `PATCH_DEFS` mod rows, `BOUNTY_NAMES`), helpers (`queueMods`, `patchFits`, `slotDef`, `newQueue`, `rollConfig`), state (`defaults`/`PERSIST`/`doPrestige`), Queues app (sockets row, bounty pill, `socketConfig`/`unsocketConfig`/`openSocketPicker`), Inventory/IDE (Config cards, `→ Socket`), workers (`assignTask`/`resolveTask` bounty branches, `tickBounties`, `spawnBounty`/`clearBounty`/`expireBounty`), `grantMaterials`. |
| `tools/aq-sim.mjs` | Balance model: mod vector, Config slots, bounty income term, two new `--checks`; derives `modTiers`, `bountyEvery`, `bountyPay`, `bountyTtl`. `--probe` accepts `FIX.mods`. |
| `tools/smoke.mjs` | Scenarios: update `stateShape` + every `mods:0` fixture; add `configs`, `faucets`, `bounty`. |
| `tools/validate-rate.mjs` | Fixture gains optional `mods` (per-queue lever vector, synthesised into one socketed Config). |
| `guide.md`, `README.md`, `CLAUDE.md`, `docs/agents-and-queues.md` | Player docs, agent context, spec status. |

### Shared helper contracts (defined in Task 2, used everywhere after)

```js
const MOD_LEVERS=["d","pay","band","speed","mats"];
const CONFIG_SLOT={id:"config", lbl:"Config", em:"🗂", stat:null};
const slotDef=item=>item.slot==="config"?CONFIG_SLOT:ASLOT[item.slot];         // any item → its slot def
function patchFits(d,item){ return d.slot===item.slot || (d.slot===null && item.slot!=="config"); }
function queueMods(q){ /* → {d,pay,band,speed,mats}, all 0 when nothing is socketed */ }
function newQueue(tier){ return {tier, seats:1, configs:Array(QUEUE_TIERS[tier].slots).fill(null), bounty:null, nextBounty:BAL.bountyEvery}; }
function queueD(q)        // base D × (1 + mods.d)
function queueBandTop(q)  // … × (1 + mods.band), ILVL_CAP-capped
a.m.payout(D,q)           // … × (1 + queueMods(q).pay)
a.m.dur(D,q)              // … ÷ (1 + (q ? queueMods(q).speed : 0))   ← q is now a parameter; every caller passes it
```

Bounty contracts (Task 5):

```js
q.bounty = null | {name, D, pay, t, ttl, kind}     // kind ∈ "mats"|"gear"|"config", rolled at spawn
const bountyWorked=q=>WK.some(w=>!w.manual&&w.task&&w.task.bounty&&w.task.q===q);   // agent zero's manual ticket never locks a bounty
function spawnBounty(q), clearBounty(a,q), expireBounty(q,why), releaseBountyTasks(q), tickBounties(dt)
```

---

### Task 1: Sim — mod vector, Config slots, bounty income, derive the numbers

**Files:**
- Modify: `tools/aq-sim.mjs` (header comment, `T`, `initial`, `queueD`/`queuePay`, `agentRate`, `rate`, `bandTop`, `options`, `optimiseSeating`, `printTable`/`run` labels, `checks`, `--probe`)

**Interfaces:**
- Produces: the numbers Task 2 copies into `BAL`: `MOD_TIERS`, `CONFIG_SLOTS`, `MAX_PATCHES`, `BOUNTY_EVERY`, `BOUNTY_PAY`, `BOUNTY_TTL`, `BOUNTY_REWARDS`, `BOUNTY_TIER_SHIFT`. Queue shape `{tier, seats, mods:{d,pay,band,speed,mats}}`.

- [ ] **Step 1: Replace the mod knobs and add the bounty knobs in `T`**

In the `T` object replace the line
```js
  MOD_D: 0.12, MOD_PAY: 1.15, MOD_ILVL: 0.12, MOD_MAX: 3,   // per mod: D ×(1+MOD_D·n), payout ×MOD_PAY^n, drop band ×(1+MOD_ILVL·n)
```
with
```js
  // Configs (Phase 3): a queue's socketed Configs carry patches ("mods"), each of which moves ONE lever by its
  // rolled value v: d → D ×(1+Σv), pay → payout ×(1+Σv), band → drop band ×(1+Σv), speed → duration ÷(1+Σv),
  // mats → material chance ×(1+Σv). MOD_TIERS are the T1/T2/T3 values (mirrors PATCH_DEFS tiers in the game).
  MOD_TIERS: [0.12, 0.20, 0.30], CONFIG_SLOTS: [2, 2, 2, 3, 3, 3], MAX_PATCHES: 4,
  // Bounties: each staffed queue spawns one every BOUNTY_EVERY s (±30%), paying BOUNTY_PAY × a ticket's payout if an
  // agent clears it within BOUNTY_TTL × (reference duration + cooldown). Reward kind weights mats/gear/config, with
  // BOUNTY_TIER_SHIFT points per tier moved from mats to gear+config (half each).
  BOUNTY_EVERY: 90, BOUNTY_PAY: 5, BOUNTY_TTL: 4, BOUNTY_REWARDS: { mats: 60, gear: 30, config: 10 }, BOUNTY_TIER_SHIFT: 4,
```
Update the header comment lines `//   configs      = …` to
```
//   configs      = socketed Config patches, one lever each: d (D×), pay (payout×), band (drop band×), speed (dur÷), mats
//   bounties     = per staffed queue: mean(chance) × BOUNTY_PAY × payout / BOUNTY_EVERY  (a throughput bonus, 10–20% of income)
```

- [ ] **Step 2: Mod vector everywhere the sim touches `q.mods`**

Add after `const SLOTS = …`:
```js
const LEVERS = ["d", "pay", "band", "speed", "mats"];
const noMods = () => ({ d: 0, pay: 0, band: 0, speed: 0, mats: 0 });
```
Change every queue literal `{ tier: …, seats: …, mods: 0 }` (in `initial`, `options`' "queue →" push, `--probe`) to `mods: noMods()`.

Replace `queueD`/`queuePay`:
```js
function queueD(q) { return T.TIERS[q.tier].D * (1 + q.mods.d); }
function queuePay(q) { return 1 + q.mods.pay; }
```
In `agentRate` change the duration line to divide by the speed lever and return `payout`:
```js
  const dur = clamp((4 + 0.30 * D) / (1 + S.speed / 40), 1.1, 16) / (1 + T.surge * surgeLvl) / (1 + q.mods.speed);
  …
  return { chance, dur, tps, uptime, credits: Math.max(0, succ * payout - killCost), succ, D, drain, regen, cycle, kill9, payout };
```
In `bandTop` replace `(1 + q.mods * T.MOD_ILVL)` with `(1 + q.mods.band)`.

In `printTable`/`run` replace the two `q.mods + "m"` label fragments with `modLabel(q)` and add near `fmtT`:
```js
const modLabel = q => LEVERS.filter(k => q.mods[k] > 0).map(k => k + Math.round(q.mods[k] * 100)).join("/") || "0m";
```

- [ ] **Step 3: Bounty income term in `rate()`**

Replace `rate`:
```js
function rate(S, kps = KPS) {
  if (S.agents.length === 1) kps = Math.max(kps, 2);   // nothing moves until you type; assume typing until the first hire
  let cr = 0, bounty = 0, succByQ = S.queues.map(() => 0);
  const seatedRates = S.queues.map(() => []);
  S.agents.forEach((a, i) => { if (a.q < 0) return; const q = S.queues[a.q]; const r = agentRate(a, q, kps, i === 0); cr += r.credits; succByQ[a.q] += r.succ; if (r.tps > 0) seatedRates[a.q].push(r); });
  // Bounties: one per BOUNTY_EVERY s on every staffed board, taken by whichever seated agent frees up first —
  // so its clear chance is the mean over the board's working agents, and it pays BOUNTY_PAY tickets' worth.
  S.queues.forEach((q, qi) => { const rs = seatedRates[qi]; if (!rs.length) return;
    const chance = rs.reduce((s, r) => s + r.chance, 0) / rs.length, payout = rs[0].payout;
    bounty += chance * T.BOUNTY_PAY * payout / T.BOUNTY_EVERY; });
  return { credits: cr + bounty, tickets: cr, bounty, succByQ };
}
```
(`payout` is the same for every agent on a board except the `tools` mult; using the first is fine for an EV model.)

- [ ] **Step 4: Bot fills patch budgets — Legacy to the 90 % line, then Enterprise**

Replace the `safeMods` helper and the "mods per queue" line in `optimiseSeating`:
```js
  // Configs: each queue has CONFIG_SLOTS × MAX_PATCHES patch slots, CRAFT of which the player has filled (at T2 value).
  // The bot spends them on Legacy Codebase (d) while the weakest seated agent still clears ≥90%, and the rest on
  // Enterprise Client (pay) — surplus Quality becomes difficulty (and D^1.5 payout), the remainder flat payout.
  const budget = q => Math.round(T.CONFIG_SLOTS[q.tier] * T.MAX_PATCHES * CRAFT), V = T.MOD_TIERS[1];
  const safeD = (a, q) => { let n = 0; for (let k = 1; k <= budget(q); k++) if (agentRate(a, { ...q, mods: { ...noMods(), d: k * V } }, kps, false).chance >= 0.9) n = k; return n; };
  const modsFor = (a, q) => { const nd = safeD(a, q); return { ...noMods(), d: nd * V, pay: (budget(q) - nd) * V }; };
```
and use `modsFor` in place of `{ ...q, mods: safeMods(...) }` in the seating loop, then set each queue's mods to the weakest seated agent's plan:
```js
  S.queues.forEach((q, qi) => { const seated = S.agents.filter(a => a.q === qi); if (!seated.length) return;
    const nd = Math.min(...seated.map(a => safeD(a, q))); q.mods = { ...noMods(), d: nd * V, pay: (budget(q) - nd) * V }; });
```

- [ ] **Step 5: Two new design-rule checks**

Append inside `checks()`:
```js
  // Configs can't skip a tier: tier t with every socket full of T3 On-Call (band) mods must still drop gear that
  // fails tier t+2 (<60% uncrafted). ILVL_CAP is what guarantees this; the check proves the cap is tight enough.
  console.log("  juiced drops can't skip a tier (all-On-Call T3 band top at t vs t+2; need <60%):");
  for (let t = 0; t + 2 < T.TIERS.length; t++) { const os = T.TIER_OS[t]; const band = T.CONFIG_SLOTS[t] * T.MAX_PATCHES * T.MOD_TIERS[2];
    const top = Math.min(T.ILVL_CAP[os], T.BAND_TOP * T.TIERS[t + 1].D * (1 + band)); const Q = T.FLOOR + top * T.COEFF.model; const ch = succChance(Q, T.TIERS[t + 2].D);
    console.log(`    ${T.TIERS[t].name.padEnd(14)} juiced top ilvl ${Math.round(top)} → Q${Math.round(Q)} vs ${T.TIERS[t + 2].name}: ${Math.round(ch * 100)}% ${ch < 0.6 ? "✓" : "✗ skips a tier"}`); }
  // Crunch never makes overreach pay: with every socket full of T3 Crunch, the income-maximising tier per gear
  // level must still be a ≥85% one (throughput scales drain/s exactly as much as credits/s).
  console.log("  overreach with max Crunch (speed mods); ✓ if best tier has ≥85% success:");
  for (const il of [10, 20, 30, 45, 60, 80, 110, 150]) { const a = newAgent(il, 0); let best = null;
    T.TIERS.forEach((tier, ti) => { const r = agentRate(a, { tier: ti, seats: 1, mods: { ...noMods(), speed: T.CONFIG_SLOTS[ti] * T.MAX_PATCHES * T.MOD_TIERS[2] } }, 0, false); if (!best || r.credits > best.r.credits) best = { ti, r }; });
    console.log(`    ilvl ${String(il).padStart(3)}: best=${T.TIERS[best.ti].name} ${Math.round(best.r.chance * 100)}% ${best.r.chance >= 0.85 ? "✓" : "✗ overreach pays"}`); }
  // Bounty share: at the bot's reference state per OS, bounties should be 10–20% of income.
  console.log("  bounty share of income per OS (reference bot state; want 10–20%):");
  { const S = initial(); for (let os = 0; os < T.TIERS.length; os++) { S.os = os; while (S.queues.length <= os && T.TIERS[S.queues.length]) S.queues.push({ tier: S.queues.length, seats: 1, mods: noMods() });
      while (S.agents.length < T.HIRE_CAP[os]) { S.hires++; S.agents.push(newAgent(T.TIERS[os].D, os)); } S.agents.forEach(a => { for (const s of SLOTS) a.gear[s] = Math.max(a.gear[s], T.TIERS[Math.max(0, a.q)].D); });
      optimiseSeating(S, 2); const R = rate(S, 2); console.log(`    OS${os}: ${Math.round(100 * R.bounty / Math.max(1e-9, R.credits))}% (${money(R.bounty)}/s of ${money(R.credits)}/s)`); } }
```
Also the existing `rows`/`best` loops in `checks()` that build `{ tier: ti, seats: 1, mods: 0 }` become `mods: noMods()` (four places).

- [ ] **Step 6: `--probe` accepts `FIX.mods`**

In the probe block, after `const queues = …`, read `const mods = F.mods ?? queues.map(() => ({}));` and build `S.queues = queues.map((q, i) => ({ tier: q.tier, seats: q.seats, mods: { ...noMods(), ...mods[i] } }));`. Update the usage comment on that line: `FIX.mods = per-queue {d,pay,band,speed,mats} lever sums`.

- [ ] **Step 7: Run the checks and the pacing table; tune until targets hold**

Run: `node tools/aq-sim.mjs --checks` then `node tools/aq-sim.mjs --kps 2 --craft 0.5 --brief` and `node tools/aq-sim.mjs --kps 0 --craft 0.5 --brief`.
Targets (spec §3): every existing check still passes; "skips a tier" ✓ at every t; Crunch ✓ at every gear level; bounty share 10–20 % at every OS; reference player (kps 2, craft 0.5) reaches STARSHIP in 4–6 h. If STARSHIP is much faster than 5 h the mod stack is too strong — lower `MOD_TIERS` (e.g. `[0.08,0.14,0.22]`) before touching anything else; if bounty share is out of band adjust `BOUNTY_PAY` (share ∝ it) not `BOUNTY_EVERY` (which is the felt cadence). Record the final numbers — they are what Task 2 mirrors.
Expected: all rows ✓, STARSHIP ≈ 5 h.

- [ ] **Step 8: Commit**

```bash
git add tools/aq-sim.mjs
git commit -m "A&Q Phase 3: sim models single-lever Config mods and bounty income

Queue mods become a vector {d,pay,band,speed,mats} — the sum of the rolled
values of the patches on a queue's socketed Configs, each patch moving one
lever (spec Phase 3 §1). MOD_D/MOD_PAY/MOD_ILVL/MOD_MAX are replaced by
MOD_TIERS (T1–T3 patch values) and CONFIG_SLOTS per tier; the bot fills each
board's patch budget with Legacy Codebase up to the weakest seated agent's
90% line and the rest with Enterprise Client.

Bounties enter income as mean(chance) × BOUNTY_PAY × payout / BOUNTY_EVERY
per staffed board (§2/§3). New --checks: a fully On-Call-juiced board can't
drop gear that clears tier t+2; max Crunch never makes overreach pay; bounty
share per OS is printed against the 10–20% target. --probe accepts FIX.mods.

Derived: <paste the final MOD_TIERS / BOUNTY_* values and the STARSHIP time>.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: State & tables — SAVE_VER 10, `queueMods`, Config slot/patches, BAL keys

**Files:**
- Modify: `index.html` — `QUEUE_TIERS` (~992), `BAL` (~1000), `queueD`/`queueBandTop` (~1013), `PATCH_DEFS` (~1030), `availablePatchIds` (~1056), `agentMult` (~1084), `SAVE_VER` (~1196), `defaults`/`PERSIST` (~1235), `buy()` queue branch (~1403), `openPicker` (~1509), `renderQueues` meta (~1494), `doPrestige` keep (~1815), `craftRefactor`/`craftFullRewrite` (~2330), `assignTask` (~2487), `offlineEarnings` (~2865), `addItemToAgent`/`equipItem` (~2249/1746)
- Modify: `tools/smoke.mjs` — `stateShape`, every `mods: 0` fixture; `tools/validate-rate.mjs` fixture line

**Interfaces:**
- Consumes: Task 1's numbers.
- Produces: the "Shared helper contracts" above (`MOD_LEVERS`, `CONFIG_SLOT`, `slotDef`, `patchFits`, `queueMods`, `newQueue`, `rollConfig`, `CONFIG_NAMES`, `a.m.dur(D,q)`), `P.bountiesDone`/`P.bountiesMissed`, `q.configs`/`q.bounty`/`q.nextBounty`.

- [ ] **Step 1: Update the `stateShape` smoke scenario first (it must fail)**

In `tools/smoke.mjs` `stateShape`, change `assert(s.ver === 9, …)` to `assert(s.ver === 10, "SAVE_VER must be 10, got " + s.ver);` and add after the "one Backlog queue" assert:
```js
    const q = s.queues[0];
    assert(!("mods" in q), "q.mods (integer) is gone — mods are derived from q.configs");
    assert(Array.isArray(q.configs) && q.configs.length === 2 && q.configs.every(c => c === null), "Backlog has two empty Config sockets");
    assert(q.bounty === null && typeof q.nextBounty === "number", "queue carries bounty/nextBounty");
    assert(s.bountiesDone === 0 && s.bountiesMissed === 0, "bounty counters present");
```
Run: `node tools/smoke.mjs stateShape` → Expected: `FAIL assert: SAVE_VER must be 10, got 9`.

- [ ] **Step 2: Tables — slots, BAL keys, Config slot, mod patches, helpers**

`QUEUE_TIERS`: add `slots` to every row (`2,2,2,3,3,3`), e.g. `{id:"backlog", name:"Backlog", D:10, os:0, em:"📥", slots:2}`. Update the comment above it: "…`slots` = Config sockets (spec Phase 3 §1)".

`BAL`: replace `payK:1.5, modPay:1.15, modD:0.12, modIlvl:0.12,` with
```js
    payK:1.5, modTiers:[0.12,0.20,0.30],   // Config patch values T1–T3 — one lever each (sim MOD_TIERS)
    bountyEvery:90, bountyPay:5, bountyTtl:4, bountyRewards:{mats:60,gear:30,config:10}, bountyTierShift:4,   // sim BOUNTY_*
```
(use Task 1's final values).

Replace `queueD`/`queueBandTop` and add the helpers right after `queueTier`:
```js
  // Phase 3 — Configs. A queue's mods are derived from the Configs in its sockets: each patch on a socketed Config
  // moves ONE lever by its rolled value. Nothing socketed → all zeros. Read per ticket/render; never cached on q.
  const MOD_LEVERS=["d","pay","band","speed","mats"];
  function queueMods(q){ const m={d:0,pay:0,band:0,speed:0,mats:0};
    for(const c of q.configs||[]){ if(!c) continue; for(const p of c.patches||[]){ const d=PATCH_DEFS[p.id]; if(d&&d.kind==="mod") m[d.mod]+=p.value; } }
    return m; }
  function queueD(q){ return queueTier(q).D*(1+queueMods(q).d); }
  function queueBandTop(q){ const t=q.tier, next=QUEUE_TIERS[t+1]?QUEUE_TIERS[t+1].D:QUEUE_TIERS[t].D*1.4;
    return Math.min(ILVL_CAP[clamp(P.up.os,0,ILVL_CAP.length-1)], BAL.bandTop*next*(1+queueMods(q).band)); }
  function newQueue(tier){ return {tier, seats:1, configs:Array(QUEUE_TIERS[tier].slots).fill(null), bounty:null, nextBounty:BAL.bountyEvery}; }
```
(`PATCH_DEFS` is declared later with `const` but `queueMods` only runs after load, so the TDZ is not an issue — same as `queueBandTop` reading `ILVL_CAP`.)

After `ASLOT=…` add:
```js
  const CONFIG_SLOT={id:"config", lbl:"Config", em:"🗂", stat:null};   // pseudo-slot: Configs are items that socket into queues, not agents
  const slotDef=item=>item.slot==="config"?CONFIG_SLOT:ASLOT[item.slot];
  const CONFIG_NAMES=["Sprint Config","CODEOWNERS","Runbook","Jira Workflow","OKR Sheet","Definition of Done","On-Call Schedule","Release Checklist","Retro Notes","Style Guide"];
```

`PATCH_DEFS`: append five rows and the `patchFits` helper below the table:
```js
    // Phase 3 — Config mods (spec Phase 3 §1). One lever each; values are BAL.modTiers so the sim stays mirrored.
    mod_d:     {slot:"config", kind:"mod", mod:"d",     lbl:"Legacy Codebase",  tiers:BAL.modTiers, gate:[0,25,55], fmt:v=>"+"+Math.round(v*100)+"% difficulty"},
    mod_pay:   {slot:"config", kind:"mod", mod:"pay",   lbl:"Enterprise Client",tiers:BAL.modTiers, gate:[0,25,55], fmt:v=>"+"+Math.round(v*100)+"% payout"},
    mod_band:  {slot:"config", kind:"mod", mod:"band",  lbl:"On-Call Rotation", tiers:BAL.modTiers, gate:[0,25,55], fmt:v=>"+"+Math.round(v*100)+"% drop ilvl"},
    mod_speed: {slot:"config", kind:"mod", mod:"speed", lbl:"Crunch",           tiers:BAL.modTiers, gate:[0,25,55], fmt:v=>"+"+Math.round(v*100)+"% ticket speed"},
    mod_mats:  {slot:"config", kind:"mod", mod:"mats",  lbl:"Open Source",      tiers:BAL.modTiers, gate:[0,25,55], fmt:v=>"+"+Math.round(v*100)+"% materials"},
  };
  // Generic gear patches (slot null) roll on any gear slot but never on a Config; slot-specific ones only on their slot.
  function patchFits(d,item){ return d.slot===item.slot || (d.slot===null && item.slot!=="config"); }
```
Rewrite `availablePatchIds` to use it, and the two inline copies in `craftRefactor` / `craftFullRewrite`:
```js
  function availablePatchIds(item){ const have=new Set((item.patches||[]).map(p=>p.id)); return Object.keys(PATCH_DEFS).filter(id=>patchFits(PATCH_DEFS[id],item)&&!have.has(id)); }
  // craftRefactor:
    const ids=Object.keys(PATCH_DEFS).filter(id=>patchFits(PATCH_DEFS[id],it)&&!have.has(id));
  // craftFullRewrite:
    const n=it.patches.length, pool=Object.keys(PATCH_DEFS).filter(id=>patchFits(PATCH_DEFS[id],it));
```
Add `rollConfig` after `rollItem` — a Config drops with one mod already on it so socketing it does something immediately:
```js
  function rollConfig(q){ const ilvl=rollIlvl(q), it={id:++P.itemSeq, slot:"config", name:pick(CONFIG_NAMES), ilvl, patches:[], maxPatches:initialMaxPatches(ilvl)};
    it.patches.push(makePatch(pick(availablePatchIds(it)),ilvl)); return it; }
```

- [ ] **Step 3: `agentMult`, callers of `dur`, and the Config guards**

In `agentMult` change the two closures:
```js
      dur:(D,q)=>clamp((BAL.durBase+BAL.durPerD*D)/(1+st.speed/BAL.speedDiv),BAL.durMin,BAL.durMax)/(1+(q?queueMods(q).speed:0)),
      payout:(D,q)=>Math.pow(D,BAL.payK)*(1+queueMods(q).pay)*st.tools*pres*focus,
```
`grep -n "\.dur(" index.html` — every call site passes the queue: `openPicker` → `a.m.dur(D,q)`, `assignTask` → `a.m.dur(D,q)`, `offlineEarnings` → `a.m.dur(D,q)`.

`renderQueues` board meta: `D${Math.round(queueD(b.q))} · ${n}/${b.q.seats} seats · drops ilvl ${b.t.D}–${Math.round(queueBandTop(b.q))}` (effective D, not `b.t.D`).

`buy()` queue branch: `P.queues.push(newQueue(u.tier));`. `defaults()`: `queues:[newQueue(0)]` — **`newQueue` reads `BAL` and `QUEUE_TIERS`, both declared above `defaults`, fine** — and add `bountiesDone:0,bountiesMissed:0,` after `crits:0,`. `PERSIST`: add `"bountiesDone","bountiesMissed"` after `"crits"`. `doPrestige` keep list: add `bountiesDone:P.bountiesDone, bountiesMissed:P.bountiesMissed,`.

`SAVE_VER=10;`.

Guards so a Config can never land in a gear slot:
```js
  function addItemToAgent(a,item){
    if(item.slot!=="config" && !a.gear[item.slot]){ a.gear[item.slot]=item; recompute(); return "equipped"; }
    a.inv.push(item); enforceInvCap(a); return "stashed";
  }
  function equipItem(a,item){ if(item.slot==="config") return;   // Configs socket into queues (Task 3), never onto an agent
```

- [ ] **Step 4: Fixtures — every `mods: 0` becomes sockets**

`tools/smoke.mjs`: replace each `{ tier: 0, seats: N, mods: 0, configs: [] }` with `{ tier: 0, seats: N, configs: [null, null], bounty: null, nextBounty: 90 }` and each tier-1 queue with `{ tier: 1, seats: 1, configs: [null, null], bounty: null, nextBounty: 90 }` (scenarios `seatAgent`, `dragSeat`, `rogue`, `offline`). Add a fixture helper next to `kit`:
```js
// Queue fixture: tier t with n seats, empty sockets, no bounty. `nextBounty` large keeps bounties out of scenarios that don't test them.
export const queue = (tier, seats, extra = {}) => Object.assign({ tier, seats, configs: Array(tier >= 3 ? 3 : 2).fill(null), bounty: null, nextBounty: 1e9 }, extra);
```
and use `queue(0, 2)` / `queue(1, 1)` in those four scenarios instead of literals.
`tools/validate-rate.mjs`: `fixture.queues = queues.map(q => ({ tier: q.tier, seats: q.seats, configs: Array(q.tier >= 3 ? 3 : 2).fill(null), bounty: null, nextBounty: 1e9 }));` (the `FIX.mods` synthesis is Task 7).

- [ ] **Step 5: Verify**

`grep -n "\.mods\b" index.html tools/*.mjs` → Expected: only vector reads (`queueMods(q).x`, `q.mods.d`, `m.mods` in the sim), no integer `mods:0` anywhere.
Run: `node tools/smoke.mjs stateShape && node tools/smoke.mjs boots && node tools/smoke.mjs loopEarns && node tools/smoke.mjs seatAgent && node tools/smoke.mjs perAgentGear`
Expected: all `PASS`.

- [ ] **Step 6: Commit**

```bash
git add index.html tools/smoke.mjs tools/validate-rate.mjs
git commit -m "A&Q Phase 3: Config item/patch tables, queueMods vector, SAVE_VER 10

Queues no longer carry an integer mods count. q.configs is a fixed-length
array of Config items (QUEUE_TIERS[].slots sockets: 2,2,2,3,3,3) and
queueMods(q) sums their patches into {d,pay,band,speed,mats}; queueD,
queueBandTop, a.m.payout and a.m.dur (which now takes the queue) read it.
Five PATCH_DEFS rows with slot:\"config\" are the mods — Legacy Codebase (+D),
Enterprise Client (+payout), On-Call Rotation (+drop ilvl), Crunch (faster
tickets), Open Source (+materials) — one lever each, values from BAL.modTiers.
patchFits() keeps generic gear patches off Configs and mods off gear;
slotDef() resolves the 🗂 Config pseudo-slot; rollConfig() drops a Config
with one mod already on it. addItemToAgent/equipItem refuse to put a Config
in a gear slot.

State: q.bounty / q.nextBounty (Task 5 uses them), P.bountiesDone /
P.bountiesMissed (persisted, kept through prestige). BAL gains modTiers and
the bounty knobs from the sim. SAVE_VER 9 → 10; no migration.

Fixtures in smoke.mjs / validate-rate.mjs use the new queue shape.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Config UI — sockets on the boards, `→ Socket` from the Inventory/IDE, Unsocket

**Files:**
- Modify: `index.html` — CSS near `.qseats` (~278), `buildQueues`/`renderQueues` (~1478), `openPicker` (~1505; extract `placePicker`), `renderIdeCard` (~1678), `renderStashList` (~1731), new `socketConfig`/`unsocketConfig`/`openSocketPicker`/`freeSocket` near `seatAgent`
- Modify: `tools/smoke.mjs` — add `configs`

**Interfaces:**
- Consumes: `queueMods`, `slotDef`, `patchSummary`, `selectedAgent`, `agentById`, `enforceInvCap`, `closePicker`, `QEL`.
- Produces: `socketConfig(qi, si, src)`, `unsocketConfig(qi, si)`, `openSocketPicker(anchor, src)` where `src` is `{owner:<agent id>, id:<item id>}` or `{craft:true}`.

- [ ] **Step 1: Write the failing `configs` scenario**

Append to `SCENARIOS` in `tools/smoke.mjs`:
```js
  // Configs: a Config in agent zero's inventory is socketed onto Kanban via the → Socket picker; the board's D and the
  // ticket payout rise; Unsocket returns it to the selected agent's inventory; the IDE's Commit adds a mod, never a gear patch.
  async configs() {
    const cfg = { id: 77, slot: "config", name: "Sprint Config", ilvl: 30, patches: [{ id: "mod_d", tier: 1, value: 0.20 }, { id: "mod_pay", tier: 1, value: 0.20 }], maxPatches: 3 };
    const s0 = await boot({ fixture: s => { s.intro = false; s.credits = 5000; s.maxCredits = 5000; s.reveal = { credits: true, shop: true, store: true }; s.up.os = 1; s.up.u_queues = 1; s.unlocked.queues = true;
      s.unlocked.inventory = true; s.unlocked.equipment = true; s.unlocked.ide = true; s.up.u_inv = 1; s.up.u_equip = 1; s.up.u_ide = 1;
      s.materials.commit = 5; s.agents[0].inv = [cfg];
      s.agents.push({ id: 2, name: "bot", color: "#0ff", gear: Object.fromEntries(["model","memory","compute","tools"].map(k => [k, kit(k, 40)])), inv: [], sanity: 100, q: 1, done: 0, failed: 0, rogue: null });
      s.queues = [queue(0, 1), queue(1, 1)]; }});
    assert(s0.agents[0].inv.some(it => it.id === 77), "fixture Config in agent zero's inventory");
    const meta0 = await ev(`document.querySelector('#queuesBody .qboard[data-q="1"] .qmeta').textContent`);
    assert(/D25\b/.test(meta0), "Kanban shows base D25 before socketing: " + meta0);
    assert(!(await ev(`!!document.querySelector('#inventoryBody .stashCard[data-id="77"] [data-act="equip"]')`)), "Config card has no Equip button");
    let r = await click('#inventoryBody .stashCard[data-id="77"] [data-act="socket"]'); assert(r === "ok", "→ Socket button on the Config card"); await sleep(200);
    const opts = await ev(`[...document.querySelectorAll('#qpicker .qopt')].map(o=>o.dataset.q+':'+o.dataset.s)`);
    assert(opts.join(",") === "0:0,1:0", "socket picker lists Backlog and Kanban with their first free socket: " + opts);
    r = await click('#qpicker .qopt[data-q="1"]'); assert(r === "ok", "choose Kanban"); await sleep(3500);
    const s1 = await readSave();
    assert(s1.queues[1].configs[0] && s1.queues[1].configs[0].id === 77, "Config sits in Kanban socket 0");
    assert(!s1.agents[0].inv.some(it => it.id === 77), "Config left the inventory");
    const meta1 = await ev(`document.querySelector('#queuesBody .qboard[data-q="1"] .qmeta').textContent`);
    assert(/D30\b/.test(meta1), "Kanban shows D30 (25 × 1.20) after socketing: " + meta1);
    assert(await ev(`document.querySelector('#queuesBody .qboard[data-q="1"] .qsock.on') !== null`), "socket tile shows the Config");
    // payout: plain Kanban pays 25^1.5 × tools(1.16) ≈ 145/ticket (≈160 with crits); juiced 30^1.5 × 1.2 × 1.16 ≈ 228 (≈250)
    await sleep(25000); const s2 = await readSave();
    assert(s2.agents[1].done >= 2, "bot cleared tickets on the juiced Kanban");
    assert(s2.earned / Math.max(1, s2.agents[1].done) > 190, "per-ticket earnings reflect the mods (got " + Math.round(s2.earned / Math.max(1, s2.agents[1].done)) + " per ticket)");
    // unsocket → back to the SELECTED agent's inventory (agent zero is selected)
    r = await click('#queuesBody .qboard[data-q="1"] .qsock.on .buy'); assert(r === "ok", "Unsocket button"); await sleep(3500);
    const s3 = await readSave();
    assert(s3.queues[1].configs[0] === null && s3.agents[0].inv.some(it => it.id === 77), "Unsocket returns the Config to the selected agent's inventory");
    // IDE: Commit on the Config rolls a mod, never a gear patch
    r = await click('#inventoryBody .stashCard[data-id="77"] [data-act="ide"]'); assert(r === "ok", "send Config to IDE"); await sleep(500);
    assert(await ev(`!document.querySelector('#ideEquip')`), "IDE offers no Equip for a Config");
    r = await ev(`(()=>{const o=document.querySelectorAll('#benchRing .orb')[0]; if(!o||o.disabled) return 'missing'; o.click(); return 'ok';})()`); assert(r === "ok", "Commit orb enabled (5 Commits, credits for the cost)"); await sleep(3500);
    const s4 = await readSave();
    assert(s4.craftSlot && s4.craftSlot.item.id === 77 && s4.craftSlot.item.patches.length === 3, "Commit added a third patch");
    assert(s4.craftSlot.item.patches.every(p => p.id.startsWith("mod_")), "every patch on a Config is a mod: " + s4.craftSlot.item.patches.map(p => p.id));
  },
```
Run: `node tools/smoke.mjs configs` → Expected: `FAIL assert: → Socket button on the Config card`.

- [ ] **Step 2: CSS**

After the `.qseats{…}` rule add:
```css
  .qsockets{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px}
  .qsock{display:inline-flex;align-items:center;gap:4px;font-size:9px;padding:2px 6px;border:1px dashed var(--edge);border-radius:4px;color:var(--dim);max-width:100%}
  .qsock.on{border-style:solid;color:var(--cyan)} .qsock.on .sn{font-weight:700} .qsock .sm{color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .qsock .buy{font-size:8.5px;padding:0 5px;margin-left:2px}
```

- [ ] **Step 3: Socket helpers and the picker (next to `seatAgent`)**

```js
  // Phase 3 — Config sockets (spec Phase 3 §1). A Config comes from an agent's inventory (or the IDE socket) and sits
  // in q.configs[si]; Unsocket hands it to the SELECTED agent — the Inventory app the player is looking at.
  const freeSocket=q=>q.configs.indexOf(null);
  function takeItem(src){   // remove and return the item a socket picker was opened for
    if(src.craft){ const it=P.craftSlot&&P.craftSlot.item; P.craftSlot=null; return it||null; }
    const a=agentById(src.owner), i=a.inv.findIndex(x=>x.id===src.id); return i<0?null:a.inv.splice(i,1)[0];
  }
  function socketConfig(qi,si,src){
    const q=P.queues[qi]; if(!q||si<0||q.configs[si]) return;
    const it=takeItem(src); if(!it) return; if(it.slot!=="config"){ selectedAgent().inv.push(it); return; }
    q.configs[si]=it; const t=queueTier(q);
    toast("🗂 Socketed",it.name+" → "+t.name+" · now D"+Math.round(queueD(q)),"#00e5ff");
    termLine("t-git","🗂","socketed "+it.name+" into "+t.name+" ("+patchSummary(it)+")");
    save(); buildQueues(); renderShop();
  }
  function unsocketConfig(qi,si){
    const q=P.queues[qi], it=q&&q.configs[si]; if(!it) return;
    q.configs[si]=null; const a=selectedAgent(); a.inv.push(it); enforceInvCap(a);
    termLine("t-dim","🗂","unsocketed "+it.name+" from "+queueTier(q).name+" → "+a.name+"'s inventory");
    save(); buildQueues(); renderShop();
  }
  function openSocketPicker(anchor,src){
    closePicker(); const m=document.createElement("div"); m.className="qpicker card"; m.id="qpicker";
    const rows=P.queues.map((q,qi)=>{ const t=queueTier(q), si=freeSocket(q), n=q.configs.filter(Boolean).length;
      return {qi,si,lbl:t.em+" "+t.name,sub:si<0?"no free socket":n+"/"+q.configs.length+" sockets · D"+Math.round(queueD(q)),full:si<0}; });
    m.innerHTML=rows.map(r=>`<div class="qopt${r.full?" full":""}" data-q="${r.qi}" data-s="${r.si}"><b>${r.lbl}</b><span>${r.sub}</span></div>`).join("");
    m.addEventListener("click",e=>{ e.stopPropagation(); const o=e.target.closest(".qopt"); if(!o||o.classList.contains("full")) return; socketConfig(+o.dataset.q,+o.dataset.s,src); closePicker(); });
    placePicker(m,anchor);
  }
```
Extract the mounting tail of `openPicker` (from `const r=anchor.getBoundingClientRect()` through the `setTimeout(...)`) into
```js
  function placePicker(m,anchor){   // mounted on body: #queuesBody scrolls/clips; clamped to the viewport in logical px
    const r=anchor.getBoundingClientRect(); m.style.left=(r.left/uiZoom)+"px"; m.style.top=(r.bottom/uiZoom+4)+"px";
    document.body.appendChild(m);
    const vw=innerWidth/uiZoom; if(r.left/uiZoom+m.offsetWidth>vw) m.style.left=Math.max(0,vw-m.offsetWidth-4)+"px";
    setTimeout(()=>document.addEventListener("click",closePicker,{once:true}),0);
  }
```
and call `placePicker(m,anchor)` from `openPicker`.

- [ ] **Step 4: Boards render sockets**

In `buildQueues`, for real boards (`b.qi>=0`) insert a sockets row between the header and the seats. Change the `el.innerHTML=` line to
```js
      el.innerHTML=`<div class="qhead"><span class="qem">${b.t.em}</span><b class="qname">${b.t.name}</b><span class="qmeta"></span></div>`+(b.qi>=0?`<div class="qsockets"></div>`:"")+`<div class="qseats"></div>`;
      if(b.qi>=0){ const row=el.querySelector(".qsockets");
        b.q.configs.forEach((c,si)=>{ const s=document.createElement("div"); s.className="qsock"+(c?" on":""); s.dataset.s=si;
          s.innerHTML=c?`<span class="sn">🗂 ${c.name}</span><span class="sm">${patchSummary(c)}</span><button class="buy">Unsocket</button>`:`empty socket`;
          if(c) s.querySelector(".buy").addEventListener("click",e=>{ e.stopPropagation(); unsocketConfig(b.qi,si); });
          row.appendChild(s); }); }
```

- [ ] **Step 5: Inventory and IDE cards know Configs**

`renderStashList`: use `slotDef(it)` for the emoji/label and swap the Equip button for `→ Socket` on Configs:
```js
    wrap.innerHTML=items.map(it=>{ const sd=slotDef(it), cfg=it.slot==="config";
      return `<div class="card stashCard" draggable="true" data-id="${it.id}" title="Drag me onto the IDE bench socket to craft"><span class="em">${sd.em}</span>`+
      `<div class="mid"><div class="nm">${it.name} <span class="lv">Lv ${it.ilvl}</span></div><div class="fx">${sd.lbl} · ${rarityOf(it)} · ${it.patches.length}/${it.maxPatches} ${cfg?"mods":"patches"} — ${patchSummary(it)}</div></div>`+
      `<div class="actions">${cfg?`<button class="buy" data-act="socket">→ Socket</button>`:`<button class="buy" data-act="equip">Equip</button>`}<button class="buy" data-act="ide">→ IDE</button><button class="buy danger" data-act="dec">+${salvageValue(it)}</button></div></div>`; }).join("");
```
and in the listener loop replace the unconditional `equip` binding with
```js
      const eq=card.querySelector('[data-act="equip"]'); if(eq) eq.addEventListener("click",e=>{e.stopPropagation();equipFromInv(a,id);});
      const so=card.querySelector('[data-act="socket"]'); if(so) so.addEventListener("click",e=>{e.stopPropagation();openSocketPicker(so,{owner:a.id,id});});
```
`renderIdeCard`: replace `ASLOT[it.slot]` with `slotDef(it)` (two places) and make the action row Config-aware:
```js
      const cfg=it.slot==="config";
      acts.innerHTML=(cfg?`<button class="buy" id="ideSocket">→ Socket</button>`:`<button class="buy" id="ideEquip">Equip on ${agentById(P.craftSlot.owner).name}</button>`)+`<button class="buy" id="ideBack">Back to inventory</button>`;
      if(cfg) acts.querySelector("#ideSocket").addEventListener("click",e=>{e.stopPropagation();openSocketPicker(e.currentTarget,{craft:true});});
      else acts.querySelector("#ideEquip").addEventListener("click",e=>{e.stopPropagation();equipFromCraftSlot();});
```
Also the empty-socket hint copy: `drag gear or a Config here from the selected agent's Inventory or Equipment — or use its "→ IDE" button`.

- [ ] **Step 6: Verify**

Run: `node tools/smoke.mjs configs && node tools/smoke.mjs seatAgent && node tools/smoke.mjs perAgentGear && node tools/smoke.mjs queuesApp`
Expected: all `PASS`. Take a screenshot (`Page.captureScreenshot` via `--keep` + an ad-hoc eval, or the `run` skill) of a board with a socketed Config to eyeball the tile.

- [ ] **Step 7: Commit**

```bash
git add index.html tools/smoke.mjs
git commit -m "A&Q Phase 3: socket Configs from the Inventory/IDE onto Queues app boards

Each board in the Queues app shows its Config sockets under the header: empty
tiles, or the Config's name + mod summary with an Unsocket button that hands
it to the selected agent's inventory. Inventory cards for Configs replace
Equip with → Socket, an inline picker (same placement code as the seating
picker, now shared as placePicker) listing owned boards with a free socket;
the IDE bench offers → Socket instead of Equip when a Config is in the socket.
socketConfig()/unsocketConfig() are the only mutations of q.configs.

smoke: new `configs` scenario (socket, D/payout change, unsocket, Commit rolls
a mod).

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Faucets — tickets pay credits + Commits; Open Source scales the Commit chance

**Files:**
- Modify: `index.html` — `grantMaterials` (~2300), `buildToolbox` materials cards (~1630), `renderMaterials` (~1714), `MATS` `does` copy (~2267)
- Modify: `tools/smoke.mjs` — add `faucets`

**Interfaces:**
- Consumes: `queueMods(q).mats`, `materialAttempt`.
- Produces: `MATS[].src` (`"tickets"` | `"bounties"` | `"loc"`) used by the IDE list and by `guide.md`.

- [ ] **Step 1: Write the failing `faucets` scenario**

```js
  // Faucets: ordinary tickets grant Commits (and the LOC Full Rewrite) but never Hotfix/Refactor/Revert/Merge — those are bounty loot.
  async faucets() {
    const s0 = await boot({ fixture: s => { s.intro = false; s.credits = 0; s.reveal = { credits: true, shop: true, store: true }; s.up.os = 2;
      s.materials = { commit: 0, hotfix: 0, refactor: 0, rewrite: 0, revert: 0, merge: 0 };
      for (let i = 0; i < 4; i++) s.agents.push({ id: 2 + i, name: "bot" + i, color: "#0ff", gear: Object.fromEntries(["model","memory","compute","tools"].map(k => [k, kit(k, 60)])), inv: [], sanity: 100, q: 1, done: 0, failed: 0, rogue: null });
      s.queues = [queue(0, 1), queue(1, 4), queue(2, 1)]; }});   // Jira owned so the old tier≥2 Merge gate would have applied
    await sleep(90000); const s1 = await readSave();
    const done = s1.agents.slice(1).reduce((n, a) => n + a.done, 0);
    assert(done >= 40, "four fast bots cleared ≥40 tickets in 90 s, got " + done);
    assert(s1.materials.commit >= 5, "Commits still trickle from tickets, got " + s1.materials.commit);
    for (const k of ["hotfix", "refactor", "revert", "merge"]) assert(s1.materials[k] === 0, k + " must not drop from ordinary tickets, got " + s1.materials[k]);
  },
```
Run: `node tools/smoke.mjs faucets` → Expected: `FAIL assert: hotfix must not drop from ordinary tickets…` (or refactor).

- [ ] **Step 2: Trim `grantMaterials`, keep the LOC milestone**

```js
  // Phase 3 (spec §3): tickets are the credit economy — they trickle Commits (× the queue's Open Source mods) and pay the
  // LOC-milestone Full Rewrite. Everything rarer (Hotfix, Refactor, Revert, Merge) is bounty loot — see clearBounty.
  function grantMaterials(q,locBefore){
    materialAttempt("commit",Math.min(0.95,0.35*(1+queueMods(q).mats)),true);   // common, no toast (too frequent)
    const milestone=1000;   // Full Rewrite is deterministic off P.loc crossing a milestone, not RNG+pity
    if(Math.floor(P.loc/milestone)>Math.floor(locBefore/milestone)){
      P.materials.rewrite=(P.materials.rewrite||0)+1;
      toast("📦 Found: Full Rewrite","LOC milestone hit — rerolls every patch on an item","#ffb000","grind");
      termLine("t-git","📦","LOC milestone → found a Full Rewrite");
    }
  }
```

- [ ] **Step 3: Materials list says where each comes from**

Add `src` to `MATS`: `commit` → `src:"tickets"`, `rewrite` → `src:"loc"`, the other four → `src:"bounties"`. In `buildToolbox`'s materials loop render the pity bar only for `src:"tickets"` and a source line otherwise:
```js
      card.innerHTML=`<span class="em">${m.em}</span><div class="mid"><div class="nm">${m.lbl} <span class="lv"></span></div>`+
        `<div class="fx">${m.does}</div>`+(m.src==="tickets"?`<div class="pity"><i></i></div>`:`<div class="fx dim">${m.src==="loc"?"every 1,000 lines of code":"⏱ bounty loot"}</div>`)+`</div>`;
      matsWrap.appendChild(card);
      matEls[m.id]={lv:card.querySelector(".lv"),pity:card.querySelector(".pity i")};
```
and in `renderMaterials` guard `if(el.pity) el.pity.style.width=…`. Change the header text to `📦 Materials — Commits from tickets, the rest from bounties`.

- [ ] **Step 4: Verify**

Run: `node tools/smoke.mjs faucets && node tools/smoke.mjs perAgentGear`
Expected: `PASS` ×2.

- [ ] **Step 5: Commit**

```bash
git add index.html tools/smoke.mjs
git commit -m "A&Q Phase 3: ordinary tickets pay credits + Commits only

grantMaterials keeps the Commit trickle (scaled by the queue's Open Source
mods) and the LOC-milestone Full Rewrite, and drops the Hotfix/Refactor/
Revert/Merge attempts — those become bounty loot in the next commit (spec
Phase 3 §3). MATS rows carry a src (tickets / bounties / loc) so the IDE's
materials list shows where each comes from instead of a pity bar that can
never fill.

smoke: new `faucets` scenario.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Bounties — spawn clock, pickup, resolve, expiry, rewards

**Files:**
- Modify: `index.html` — new `BOUNTY_NAMES` next to `TASKS` (~918), new bounty functions after `dropHardware` (~2266), `assignTask`/`resolveTask` (~2481), `tickProgress` (~2553), `seatAgent` (no change needed — it nulls `w.task`, so a bounty in flight is simply released)
- Modify: `tools/smoke.mjs` — add `bounty`

**Interfaces:**
- Consumes: `queueD`, `queueMods`, `queueBandTop`, `rollIlvl`, `rollItem`, `rollConfig`, `addItemToAgent`, `P.unlocked.queues`, `BAL.bounty*`.
- Produces: `spawnBounty(q)`, `clearBounty(a,q)`, `expireBounty(q,why)`, `tickBounties(dt)`, `bountyWorked(q)`, `bountyTtl(q)`, `w.task.bounty` (boolean), CSS hook classes `.agent.bounty` (Task 6 styles them).

- [ ] **Step 1: Write the failing `bounty` scenario**

```js
  // Bounties: a bounty pre-placed on the Backlog is taken by the next free agent, pays its `pay`, bumps P.bountiesDone
  // and (first ever) yields a Config; a bounty whose clock runs out expires unrewarded and counts as missed.
  async bounty() {
    const mk = (id, q) => ({ id, name: "bot" + id, color: "#0ff", gear: Object.fromEntries(["model","memory","compute","tools"].map(k => [k, kit(k, 40)])), inv: [], sanity: 100, q, done: 0, failed: 0, rogue: null });
    const s0 = await boot({ fixture: s => { s.intro = false; s.credits = 0; s.earned = 0; s.reveal = { credits: true, shop: true, store: true }; s.up.os = 1; s.up.u_queues = 1; s.unlocked.queues = true;
      s.agents.push(mk(2, 0));
      s.queues = [queue(0, 2, { bounty: { name: "Hotfix prod before the demo", D: 10, pay: 500, t: 40, ttl: 40, kind: "config" } })]; }});
    assert(s0.queues[0].bounty && s0.queues[0].bounty.t <= 40, "bounty restored and its clock runs only in the loop");
    let s1, waited = 0;
    while (waited < 20000) { await sleep(2000); waited += 2000; s1 = await readSave(); if (s1.bountiesDone >= 1) break; }
    assert(s1.bountiesDone === 1, "the bot cleared the bounty within 20 s (done=" + s1.bountiesDone + ", missed=" + s1.bountiesMissed + ")");
    assert(s1.queues[0].bounty === null, "bounty cleared off the board");
    assert(s1.earned >= 500, "bounty paid its pay (earned " + s1.earned + ")");
    const cfgs = s1.agents[1].inv.filter(it => it.slot === "config");
    assert(cfgs.length === 1 && cfgs[0].patches.length === 1 && cfgs[0].patches[0].id.startsWith("mod_"), "first bounty ever pays a Config with one mod");
    const pill = await ev(`document.querySelector('#queuesBody .qboard[data-q="0"] .qbounty').className`);
    assert(!/\bon\b/.test(pill), "bounty pill hidden after the clear: " + pill);
    // expiry: a 1 s bounty dies unrewarded even though the bot has already picked it up (its ticket downgrades)
    const s2 = await boot({ fixture: s => { s.intro = false; s.credits = 0; s.earned = 0; s.reveal = { credits: true, shop: true, store: true }; s.up.os = 1; s.up.u_queues = 1; s.unlocked.queues = true; s.bountiesDone = 1; s.bountiesMissed = 0;
      s.materials.hotfix = 0; s.materials.refactor = 0; s.agents = [s.agents[0]]; s.agents.push(mk(2, 0));
      s.queues = [queue(0, 2, { bounty: { name: "Rotate the leaked API key", D: 10, pay: 500, t: 1, ttl: 40, kind: "mats" } })]; }});
    await sleep(6000); const s3 = await readSave();
    assert(s3.queues[0].bounty === null, "expired bounty is removed");
    assert(s3.bountiesMissed === 1 && s3.bountiesDone === 1, "expiry counts as missed, not done (done=" + s3.bountiesDone + ", missed=" + s3.bountiesMissed + ")");
    assert(s3.materials.hotfix === 0 && s3.materials.refactor === 0, "no reward on expiry");
  },
```
(`boot()` can be called twice in one scenario: it reconnects to the same page and reloads with the new fixture — the second fixture resets `agents` because it starts from the first run's save. Agent zero stays seated on the Backlog in both: its idle manual ticket must not block the bot from taking the bounty — that is the `!w.manual` rule in `bountyWorked`.)
Run: `node tools/smoke.mjs bounty` → Expected: `FAIL assert: the bot cleared the bounty within 20 s`.

- [ ] **Step 2: Tables and bounty functions**

After `TASKS` add:
```js
  const BOUNTY_NAMES=["Hotfix prod before the demo","CEO's laptop is 'slow'","Rotate the leaked API key","Migrate the billing DB tonight","Un-break the Friday deploy",
    "Get the intern's PR merged","Make the dashboard green again","Restore the backup that 'never fails'","Ship the feature sales already sold","Find out who pushed to main"];
```
After `dropHardware`:
```js
  /* ============ bounties (spec Phase 3 §2) ============ */
  // A bounty is a timed special ticket on one board: q.bounty = {name, D, pay, t, ttl, kind}. It spawns on a per-board
  // clock (q.nextBounty) that only runs while the board is staffed, is taken by the NEXT FREE agent there (derived from
  // the workers — never stored), pays BAL.bountyPay tickets' worth plus a reward, and expires unrewarded on a miss or a
  // fail. Clocks tick in tickProgress, so hidden tabs, the boss key and closed tabs pause them; offline ignores bounties.
  // Agent zero's manual ticket never locks a bounty: an idle player must not block it, so an automatic agent can take
  // the same bounty and whoever clears first gets it (the other's ticket downgrades via the `live` check in resolveTask).
  const bountyWorked=q=>WK.some(w=>!w.manual&&w.task&&w.task.bounty&&w.task.q===q);
  function bountyTtl(q){ const D=queueD(q);   // a few tickets' worth for an agent geared for this D (Speed ≈ floor + D)
    const ref=clamp((BAL.durBase+BAL.durPerD*D)/(1+(BAL.floor+D)/BAL.speedDiv),BAL.durMin,BAL.durMax)/(1+queueMods(q).speed);
    return Math.round(BAL.bountyTtl*(ref+BAL.cooldown)); }
  function rollBountyKind(q){
    if(P.bountiesDone===0) return "config";   // the first clear always shows the player what a Config is
    const s=BAL.bountyTierShift*q.tier, w={mats:BAL.bountyRewards.mats-s, gear:BAL.bountyRewards.gear+s/2, config:BAL.bountyRewards.config+s/2};
    let r=Math.random()*(w.mats+w.gear+w.config); for(const k of ["mats","gear","config"]){ r-=w[k]; if(r<=0) return k; } return "mats";
  }
  function spawnBounty(q){
    const D=queueD(q), ttl=bountyTtl(q), t=queueTier(q);
    q.bounty={name:pick(BOUNTY_NAMES), D, pay:Math.round(Math.pow(D,BAL.payK)*(1+queueMods(q).pay)*BAL.bountyPay), t:ttl, ttl, kind:rollBountyKind(q)};
    termLine("t-warn","⏱","BOUNTY on "+t.name+": ‹"+q.bounty.name+"› — "+money(q.bounty.pay)+" if cleared in "+ttl+"s");
    toast("⏱ Bounty on "+t.name,q.bounty.name+" · "+money(q.bounty.pay)+" · "+ttl+"s","#ffb000","progress");
  }
  const KIND_EM={mats:"📦",gear:"🧰",config:"🗂"};
  function grantBountyReward(a,q,kind){
    if(kind==="config"){ const it=rollConfig(q); addItemToAgent(a,it); return "🗂 "+it.name+" (Lv "+it.ilvl+", "+patchSummary(it)+")"; }
    if(kind==="gear"){ const lo=queueTier(q).D, hi=Math.max(lo,queueBandTop(q)), it=rollItem(pick(ASLOT_IDS),Math.round(rand(lo+(hi-lo)*2/3,hi)));
      const where=addItemToAgent(a,it); return "🧰 "+it.name+" (Lv "+it.ilvl+")"+(where==="equipped"?" — equipped":""); }
    const got=["hotfix","refactor"]; if(Math.random()<0.25) got.push("revert"); if(q.tier>=2&&Math.random()<0.15) got.push("merge");
    for(const k of got) P.materials[k]=(P.materials[k]||0)+1;
    return "📦 "+got.map(k=>MAT[k].lbl).join(" + ");
  }
  function releaseBountyTasks(q){   // any worker still holding this board's bounty goes back to an ordinary ticket look
    for(const w of WK) if(w.task&&w.task.bounty&&w.task.q===q){ w.task.bounty=false; w.el.classList.remove("bounty"); const t=queueTier(q); w.sTag.textContent=t.em+" "+t.name; w.sTag.style.color="#00e5ff"; w.prog.style.background="linear-gradient(90deg,#00e5ff,#fff2)"; }
  }
  function clearBounty(a,q){
    const b=q.bounty; q.bounty=null; P.bountiesDone++; releaseBountyTasks(q);
    const what=grantBountyReward(a,q,b.kind);
    celebrate("⏱ BOUNTY CLEARED","#ffb000");
    toast("⏱ Bounty cleared — "+money(b.pay),a.name+" · "+what,"#ffb000","progress");
    termLine("t-ok","⏱",a.name+" cleared bounty ‹"+b.name+"›  +"+money(b.pay)+"  → "+what);
  }
  function expireBounty(q,why){
    const b=q.bounty; if(!b) return; q.bounty=null; P.bountiesMissed++; releaseBountyTasks(q);
    termLine("t-warn","⏱","bounty ‹"+b.name+"› expired — "+why);
  }
  function tickBounties(dt){
    if(!P.unlocked.queues) return;   // bounties live on the Queues app's boards
    P.queues.forEach((q,qi)=>{
      if(q.bounty){ q.bounty.t-=dt; if(q.bounty.t<=0) expireBounty(q,"nobody cleared it in time"); return; }
      if(!P.agents.some(a=>a.q===qi&&!a.rogue)) return;   // the clock only runs on a staffed board
      q.nextBounty-=dt; if(q.nextBounty<=0){ q.nextBounty=BAL.bountyEvery*rand(0.7,1.3); spawnBounty(q); }
    });
  }
```

- [ ] **Step 3: Workers take, clear and fail bounties**

`assignTask` — after `const D=queueD(q);` decide whether this ticket is the bounty:
```js
    const b=(q.bounty&&!bountyWorked(q))?q.bounty:null;
    const D=b?b.D:queueD(q);
    const name=b?b.name:pick(TASKS)[0];
    if(!a.m) agentMult(a);
    const dur=a.m.dur(D,q);
    w.task={name,D,dur,q,bounty:!!b}; w.elapsed=0; w.flashT=0;
    w.el.classList.remove("win","fail","crit"); w.el.classList.toggle("bounty",!!b);
    const t=queueTier(q);
    w.tk.textContent=name; w.sTag.textContent=b?"⏱ BOUNTY":t.em+" "+t.name; w.sTag.style.color=b?"#ffb000":"#00e5ff";
    w.prog.style.background=b?"linear-gradient(90deg,#ffb000,#fff2)":"linear-gradient(90deg,#00e5ff,#fff2)";
```
(remove the old `const D=…`/`const [name]=pick(TASKS)` lines; keep the stars/termLine lines.)

`resolveTask` — destructure `bounty` and branch the payout and the failure:
```js
    const a=workerAgent(w), {name,D,q,bounty}=w.task;
    …
    if(Math.random()<chance){
      const crit=Math.random()<0.05?3:1; if(crit>1)P.crits++;
      const live=bounty&&q.bounty;   // the bounty may have expired mid-ticket — then this pays as an ordinary ticket
      const cr=Math.round((live?q.bounty.pay:a.m.payout(D,q))*crit), xp=Math.round((D+6)*crit);
      …(unchanged through grantMaterials)…
      if(live) clearBounty(a,q);
    } else {
      …(unchanged)…
      if(bounty&&q.bounty) expireBounty(q,a.name+" failed it");
      if(a.sanity<=0) goRogue(a);
    }
    w.task=null; w.cooldown=rand(0.4,1.0); w.el.classList.remove("bounty");
```
`tickProgress`: add `tickBounties(dt);` right after `P.playSecs+=dt;`.

- [ ] **Step 4: Verify**

Run: `node tools/smoke.mjs bounty && node tools/smoke.mjs loopEarns && node tools/smoke.mjs rogue && node tools/smoke.mjs offline`
Expected: all `PASS` (the `bounty` pill assertion needs Task 6's markup — if it is the only failure, proceed to Task 6 and re-run; otherwise fix here).

- [ ] **Step 5: Commit**

```bash
git add index.html tools/smoke.mjs
git commit -m "A&Q Phase 3: bounties — timed tickets the next free agent takes, crafting loot on clear

Each staffed board (Queues app owned, ≥1 seated non-rogue agent) runs a spawn
clock (q.nextBounty, BAL.bountyEvery ±30%). A bounty is q.bounty = {name, D,
pay, t, ttl, kind}: D and payout frozen at spawn, pay = bountyPay tickets'
worth, ttl = bountyTtl × a reference ticket at that D. assignTask hands it to
the next agent on the board that frees up (bountyWorked(q) is derived from
the workers, never stored, so a reload just lets the next agent re-take it).
A clear pays `pay` plus a reward — materials bundle / band-top gear / a
Config with one mod (first clear ever is always a Config) — weighted by
BAL.bountyRewards shifted toward gear+Config with tier. A fail or a clock at
zero expires it unrewarded (P.bountiesMissed); an in-flight bounty ticket
downgrades to an ordinary one. Clocks tick in tickProgress only, so hidden/
closed tabs and the boss key pause them; offlineEarnings ignores bounties.

smoke: new `bounty` scenario (pickup + pay + first-Config, expiry).

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Bounty UI — board pill with countdown bar, agent tile styling

**Files:**
- Modify: `index.html` — CSS near `.qsockets` (Task 3) and `.agent.crit` (~419), `buildQueues`/`renderQueues` (~1478)

**Interfaces:**
- Consumes: `q.bounty`, `KIND_EM`, `bountyWorked(q)`, `.agent.bounty` class set by Task 5.

- [ ] **Step 1: CSS**

```css
  .qbounty{display:none;align-items:center;gap:6px;font-size:9.5px;margin:0 0 4px;padding:2px 7px;border:1px dashed var(--amber);border-radius:10px;color:var(--amber)}
  .qbounty.on{display:flex} .qbounty .bn{font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .qbounty .bt{font-variant-numeric:tabular-nums;white-space:nowrap} .qbounty .bk{opacity:.85}
  .qbounty .bar{display:block;width:44px;height:4px;background:#0b1220;border:1px solid var(--edge);border-radius:2px;overflow:hidden} .qbounty .bar b{display:block;height:100%;background:var(--amber);box-shadow:0 0 6px rgba(255,176,0,.6)}
  .qbounty.urgent{animation:blink .6s steps(2) infinite}
  .agent.bounty{border-color:var(--amber)} .agent.bounty .ah .sTag{color:var(--amber)}
```

- [ ] **Step 2: Pill markup and 5 Hz update**

In `buildQueues`, real boards get the pill between the sockets row and the seats: extend the `innerHTML` to `…<div class="qsockets"></div><div class="qbounty"><span class="bk"></span><span class="bn"></span><span class="bt"></span><i class="bar"><b></b></i></div><div class="qseats"></div>` (Bench board: no pill) and cache it: `QEL.boards.push({...b,el,meta:el.querySelector(".qmeta"),bounty:el.querySelector(".qbounty")})`.

In `renderQueues`, inside the `if(b.qi>=0)` branch:
```js
        const bo=b.q.bounty, pe=b.bounty;
        pe.classList.toggle("on",!!bo);
        if(bo){ const s=Math.max(0,Math.ceil(bo.t)); pe.querySelector(".bk").textContent=KIND_EM[bo.kind]; pe.querySelector(".bn").textContent="⏱ "+bo.name+" · "+money(bo.pay)+(bountyWorked(b.q)?" · in progress":"");
          pe.querySelector(".bt").textContent=Math.floor(s/60)+":"+String(s%60).padStart(2,"0"); pe.querySelector(".bar b").style.width=clamp(bo.t/bo.ttl*100,0,100)+"%";
          pe.classList.toggle("urgent",bo.t<10); pe.title="pays "+money(bo.pay)+" + "+bo.kind+" if an agent on this board clears it in time"; }
```
Update `#queuesTag` to include open bounties: `… + " · " + P.queues.filter(q=>q.bounty).length + " bounty open"` when > 0.

- [ ] **Step 3: Verify**

Run: `node tools/smoke.mjs bounty && node tools/smoke.mjs queuesApp && node tools/smoke.mjs configs`
Expected: all `PASS`. Screenshot a board with a live bounty (boot with `--keep` and a fixture `bounty.t: 300`) and check the pill reads at 1920×1080.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "A&Q Phase 3: bounty pill on Queues app boards, amber bounty tickets on agent tiles

Each board shows its open bounty as a dashed amber pill — reward kind, name,
pay, m:ss countdown and a draining bar that blinks under 10 s, plus \"in
progress\" once an agent has it. Agent tiles working a bounty get the amber
border/tag/progress bar set in assignTask. The Queues tag counts open
bounties.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Validator fixture, docs, spec status, full pass

**Files:**
- Modify: `tools/validate-rate.mjs`, `guide.md`, `README.md`, `CLAUDE.md`, `docs/agents-and-queues.md`, `tools/aq-sim.mjs` (header only if Task 1 missed anything)

- [ ] **Step 1: `validate-rate.mjs` synthesises Configs from `FIX.mods`**

After the `fixture.queues = …` line:
```js
// Optional: F.mods = per-queue {d,pay,band,speed,mats} lever sums → one socketed Config carrying a patch per lever, so a
// juiced board can be measured against `aq-sim.mjs --probe` (which takes the same FIX.mods).
const mods = F.mods ?? [];
fixture.queues.forEach((q, i) => { const m = mods[i]; if (!m) return;
  const patches = Object.entries(m).filter(([, v]) => v > 0).map(([k, v]) => ({ id: "mod_" + k, tier: 1, value: v }));
  q.configs[0] = { id: ++seq, slot: "config", name: "fixture config", ilvl: 60, patches, maxPatches: Math.max(4, patches.length) }; });
```
Run: `FIX='{"agents":3,"ilvl":30,"queues":[{"tier":1,"seats":3}],"seat":[0,0,0],"mods":[{"d":0.4,"pay":0.4}]}' node tools/validate-rate.mjs 0 120` and `FIX='{"agents":3,"ilvl":30,"queues":[{"tier":1,"seats":3}],"seat":[0,0,0],"mods":[{"d":0.4,"pay":0.4}]}' node tools/aq-sim.mjs --probe --craft 0`.
Expected: `creditsPerSec` within ~20 % (the game now also earns from bounties, which `--probe` includes via `rate()` only in `run`, so compare the *ticket* rate: the validator's number should sit between the probe's ticket-only and ticket+bounty figures — note which in the commit message).

- [ ] **Step 2: `guide.md`**

- In `## Queues` add a subsection `### Configs (queue mods)`: what a Config is (an item with 🗂, drops only from bounties, one mod already on it), the five mods table (name → one lever, T1–T3 values), sockets per board (2 / 3), how to socket (Inventory → Socket, or IDE → Socket) and Unsocket (goes to the selected agent's inventory), the "raise the agent, then mod the board until it barely qualifies" loop, and that Configs are crafted on the same bench with the same materials.
- Add `### Bounties`: spawn (Queues app, staffed boards, ~every 90 s ± 30 %, one per board), pickup (next free agent, agent zero by typing), timer pauses when the tab is hidden/closed, pay (5 tickets' worth), rewards (materials bundle / band-top gear / Config; first clear is always a Config), expiry (miss or fail, no penalty beyond the lost reward), the pill.
- In `## Patches & crafting` add the "where materials come from" table: Commit ← tickets (× Open Source), Full Rewrite ← every 1,000 LOC, Hotfix/Refactor/Revert/Merge ← bounties. Mention Configs take Config-only patches.
- `## Store` → `### Team`: no change except a sentence that boards have Config sockets.

- [ ] **Step 3: `README.md`, `CLAUDE.md`, spec**

- `README.md`: extend the Queues bullet with "…juice a board with socketed **Configs** (single-stat mods) and clear timed **bounties** for crafting loot."
- `CLAUDE.md` "Current state": Phases 1–3 shipped; "Phase 4 (Automation, rogue types, Red Team, docs pass) is next". Architecture bullets to add: **`queueMods(q)` is the only mod read** (vector from `q.configs`; never cache on `q`; `a.m.dur(D,q)` takes the queue); **Configs are items with `slot:"config"`** — `slotDef`/`patchFits` are the polymorphism points, `socketConfig`/`unsocketConfig` the only `q.configs` mutations; **bounty pickup is derived** (`bountyWorked(q)`), clocks tick only in `tickProgress`, `offlineEarnings` ignores bounties; faucets (tickets → Commits, bounties → the rest). Smoke list gains `configs faucets bounty`; verification loop updated.
- `docs/agents-and-queues.md`: `## Status` gets a Phase 3 paragraph (what shipped, `SAVE_VER 10`, smoke count 16, the sim numbers Task 1 landed); Phase 3 checkboxes ticked (the Mission Board one with "already removed in Phase 1"); "Still open" drops "bounties" from the to-model list and adds "Legacy Monolith unlimited sockets" + "Pager Integration offline efficiency".

- [ ] **Step 4: Full verification pass**

Run: `for s in boots stateShape loopEarns storeHire seatGate noOldSystems perAgentGear queuesApp buyQueue seatAgent dragSeat bench rogue offline configs faucets bounty; do node tools/smoke.mjs $s || break; done`
Expected: 17 × `PASS`, no `FAIL`. Also `node tools/aq-sim.mjs --checks` → every row ✓.

- [ ] **Step 5: Commit**

```bash
git add tools/validate-rate.mjs guide.md README.md CLAUDE.md docs/agents-and-queues.md
git commit -m "A&Q Phase 3 complete: docs, validator Config fixtures, spec status

guide.md documents Configs (the five single-lever mods, sockets, socket/
unsocket flow, the mod-until-it-barely-qualifies loop), bounties (spawn,
pickup, timer, rewards, expiry) and the material faucets table; README and
CLAUDE.md (architecture bullets for queueMods/slotDef/patchFits/socketConfig,
derived bounty pickup, faucets; smoke list now 17 scenarios) follow.
validate-rate.mjs accepts FIX.mods and synthesises a socketed Config so a
juiced board can be checked against aq-sim --probe. Spec Status line and
Phase 3 checkboxes updated; Phase 4 is next.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Self-review (done while writing)

- **Spec coverage.** §1 item/slot/names → Task 2; mods table + `patchFits` → Task 2; sockets + `queueMods` + `q.mods` deletion → Task 2; UI (sockets row, → Socket picker, Unsocket, IDE) → Task 3; source = bounties only → Task 5 (`rollConfig` is only called from `grantBountyReward`). §2 spawn clock/Queues-app gate/`q.bounty` shape/names/pause → Task 5; pickup derived → Task 5; resolve/expire/mid-ticket downgrade → Task 5; reward weights/first-Config → Task 5; pill/terminal/toasts → Tasks 5–6; state/prestige keep → Task 2. §3 `grantMaterials` trim + Open Source → Task 4; sim vector/bounty term/checks/targets → Task 1; `BAL` keys → Task 2; `FIX.mods` → Tasks 1 & 7; Mission Board note → Task 7. §4 scenarios `configs`/`faucets`/`bounty` → Tasks 3/4/5; `stateShape` + fixtures → Task 2; docs → Task 7.
- **Placeholders.** None: every code step has the code; the only "fill in" is Task 1's derived numbers, which the task's Step 7 produces and Task 2 copies.
- **Type consistency.** `queueMods(q)` → `{d,pay,band,speed,mats}` everywhere (sim uses the same keys). `a.m.dur(D,q)` signature used in `openPicker`, `assignTask`, `offlineEarnings`, `bountyTtl` (which computes its own reference duration, not `a.m`). `q.bounty.kind` ∈ `mats|gear|config` in `rollBountyKind`, `grantBountyReward`, `KIND_EM`, the smoke fixtures. `src` for `openSocketPicker` is `{owner,id}` (stash) or `{craft:true}` (IDE), consumed by `takeItem`. `queue(tier, seats, extra)` fixture helper is defined in Task 2 and used by Tasks 3–5.
- **Risk noted for the executor.** `agentMult`'s `dur` now divides by the queue's speed mods — `validate-rate`/`--probe` agreement (Task 7 Step 1) is the check that both sides did it. `expireBounty` compares `w.task.q===q` by identity; `P.queues` entries are stable objects between reloads, and `doPrestige` rebuilds workers, so identity holds.
