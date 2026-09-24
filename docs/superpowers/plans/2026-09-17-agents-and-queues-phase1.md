# Agents & Queues — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the game's global stats/machine/model/8-slot-equipment economy with per-agent sheets (3 stats from 4 gear slots, no levels, own inventory, own sanity) working a single Junior queue, with hires and seats purchasable — the "agent sheet + queue skeleton" of `docs/agents-and-queues.md` Phase 1.

**Architecture:** Everything stays inside the one IIFE in `index.html`. New data tables (`AGENT_STATS`, `AGENT_SLOTS`, `QUEUE_TIERS`, `BAL`) replace `STATS`/`MACH`/`MODEL`/`HIRE`/`SLOTS`. State moves from `P.stats`/`P.equip`/`P.toolbox`/`P.hp` to `P.agents[]` (each `{gear, inv, sanity, q}`) and `P.queues[]`. `recompute()` becomes per-agent: it writes a derived `a.m` struct onto each agent (never persisted). The worker loop (`WK`) maps 1:1 onto `P.agents`. Verification is a headless-Chrome smoke harness (`tools/smoke.mjs`) that boots the real game, injects fixtures, dispatches real input and asserts on the saved state — there is no unit-test framework and the IIFE is not importable.

**Tech Stack:** Vanilla JS in one HTML file (no build), Node 22 + Chrome DevTools Protocol for verification, `tools/aq-sim.mjs` for the balance numbers.

**Spec:** `docs/agents-and-queues.md` (sections "The two systems", "Queues", "Balance model — derived skeleton", "Phased delivery → Phase 1", "Decisions log").

## Global Constraints

- **No save migration, ever.** Bump `SAVE_VER` to `8` in Task 2; a mismatched save boots into Guru Meditation and is wiped. Never write backfill code. Tasks 4–6 keep changing the shape under version 8 — that is fine on this branch because the smoke harness always starts from a fresh Chrome profile; **wipe your own local save between tasks** (Settings → reset, or clear site data). Nothing ships until Phase 1 is merged.
- **`main` auto-deploys.** All work lands on the long-lived branch `agents-and-queues`; never merge to `main` in this plan.
- **Data-driven tables, not scattered conditionals** (CLAUDE.md). New content = a table row + small function.
- **Balance numbers come from the sim** (`docs/agents-and-queues.md` "Balance model"): stat = `10 + ilvl × 1.0 × (1 + patchPct)`; success = `clamp(0.5 + (Quality/D − 1) × 1.25, 0, 0.95)`; duration = `clamp((4 + 0.3·D) / (1 + Speed/40), 1.1, 16)`; payout = `D^1.5 × 1.15^mods × tools`; sanity drain/ticket = `D × 0.3 × (0.1 + 3·(1 − success))`; regen = `0.02 × Stamina`/s; drops 10%/success with ilvl uniform in `[D, 0.92 × nextD]`, capped by `ILVL_CAP = [30,55,85,125,175,9999]`; hire n = `150 × 3.2^(n−1)`, `HIRE_CAP = [1,2,4,6,8,10]`; seat n on tier t = `150 × 2.2^(n−1) × 4^t`; OS costs `[0, 4000, 40000, 400000, 3000000, 24000000]`.
- **Agent zero earns nothing idle** (typing only, Decisions log). No Autocomplete Assist.
- **Stages are story only** (Decisions log): no stage-up heal, no stage XP multiplier.
- **Docs are part of done:** `guide.md`, `README.md`, `CLAUDE.md` updated in the last task, not later.
- **Commit after every task** with a detailed message (CLAUDE.md git workflow); never commit to `main`.
- **Verification recipe** (CLAUDE.md): headless Chrome via CDP; fixture injection = `localStorage.setItem(...)` then immediately `localStorage.setItem=function(){}` **before** `location.reload()`; IIFE internals are unreachable from `Runtime.evaluate`, so drive real DOM clicks / `Input.dispatchKeyEvent`; check both `Runtime.exceptionThrown` and `exceptionDetails`.

---

## File map

| File | Change |
|---|---|
| `tools/smoke.mjs` | **Create.** Reusable CDP harness + named scenarios (`node tools/smoke.mjs <scenario>`). Every task adds a scenario. |
| `index.html` | **Modify.** All game changes. Line numbers below are from the branch tip at plan time (`1a091f7`); re-grep by function name if they drift. |
| `tools/validate-rate.mjs` | **Modify.** Fixture re-specified for the new state shape; compares against `tools/aq-sim.mjs --probe`. |
| `tools/aq-sim.mjs` | **Modify.** Add a `--probe` mode mirroring the validator fixture. |
| `guide.md`, `README.md`, `CLAUDE.md`, `docs/agents-and-queues.md` | **Modify.** Player docs + architecture notes + Phase 1 checkboxes. |

---

### Task 1: Smoke harness

**Files:**
- Create: `tools/smoke.mjs`

**Interfaces:**
- Produces: `node tools/smoke.mjs <scenario>` exits 0 on pass, 1 on fail, printing `PASS`/`FAIL <reason>`. Exposes helpers used by later scenarios: `boot({fixture})`, `ev(expr)`, `click(selector)`, `type(kps, secs)`, `readSave()`, `sleep(ms)`, `assert(cond, msg)`.
- Scenario `boots`: fresh game boots with no page exceptions and writes a save with `ver === SAVE_VER`.

- [ ] **Step 1: Write the harness**

```js
#!/usr/bin/env node
// Headless-Chrome smoke harness for vibe hacker. The game is one IIFE, so nothing inside it is
// reachable from Runtime.evaluate: we drive real DOM clicks / key events and read state back
// through the game's own save (localStorage "vibehacker").
// Usage: node tools/smoke.mjs <scenario> [--keep]      (see SCENARIOS at the bottom)
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = 9400 + Math.floor(Math.random() * 500);
const dir = mkdtempSync(path.join(tmpdir(), "vh-smoke-"));
const url = "file://" + path.resolve("index.html");
const chrome = spawn("google-chrome", ["--headless=new", "--disable-gpu", "--no-sandbox", `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, "--window-size=1920,1080", url], { stdio: "ignore" });
export const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); export const exceptions = [];
async function connect() {
  for (let i = 0; i < 60; i++) { try { const j = await (await fetch(`http://localhost:${PORT}/json`)).json(); const p = j.find(x => x.type === "page"); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch { } await sleep(200); }
  await new Promise(r => ws.onopen = r);
  ws.onmessage = e => { const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
    else if (m.method === "Runtime.exceptionThrown") exceptions.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); };
}
export const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
export async function ev(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("eval failed: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text) + "\n  expr: " + expr.slice(0, 200));
  return r.result?.value;
}
export const readSave = () => ev(`JSON.parse(localStorage.getItem("vibehacker"))`);
export const click = sel => ev(`(()=>{const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return "missing"; el.click(); return "ok";})()`);
export async function type(kps, secs) {
  const n = Math.round(kps * secs);
  for (let i = 0; i < n; i++) { send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", text: "a" }); send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA" }); await sleep(1000 / kps); }
}
export function assert(cond, msg) { if (!cond) throw new Error("assert: " + msg); }
// Boot the game; optionally replace the save with `fixture(save)` (a function mutating the fresh save) and reload.
export async function boot({ fixture } = {}) {
  await connect(); await send("Runtime.enable"); await send("Page.enable");
  await sleep(4000);
  let save = await readSave(); if (!save) { await sleep(4000); save = await readSave(); }
  assert(save, "game never wrote a save");
  if (fixture) {
    fixture(save);
    await ev(`localStorage.setItem("vibehacker", ${JSON.stringify(JSON.stringify(save))}); document.cookie="vibehacker=;max-age=0"; localStorage.setItem=function(){}; "ok"`);
    await send("Page.reload"); await sleep(3500);
    await ev(`delete localStorage.setItem; "ok"`);
    await sleep(3500);   // let the game's 3 s autosave write the restored state once
  }
  return readSave();
}
export async function done(pass, why) {
  if (exceptions.length) { pass = false; why = "page exceptions: " + exceptions.join(" | "); }
  console.log(pass ? "PASS" : "FAIL " + why);
  if (!process.argv.includes("--keep")) chrome.kill();
  process.exit(pass ? 0 : 1);
}

/* ===================== scenarios (one per plan task; add below) ===================== */
export const SCENARIOS = {
  async boots() {
    const s = await boot();
    assert(typeof s.ver === "number", "save has no ver");
    assert(s.intro === true, "fresh game should be in intro");
  },
};

const name = process.argv[2];
if (!SCENARIOS[name]) { console.log("scenarios: " + Object.keys(SCENARIOS).join(", ")); process.exit(2); }
try { await SCENARIOS[name](); await done(true); } catch (e) { await done(false, e.message); }
```

- [ ] **Step 2: Run it against the current game to prove the harness works**

Run: `node tools/smoke.mjs boots`
Expected: `PASS`

- [ ] **Step 3: Prove it detects failures** — temporarily change `assert(s.intro === true` to `assert(s.intro === false`, run again.

Expected: `FAIL assert: fresh game should be in intro`. Revert the change.

- [ ] **Step 4: Commit**

```bash
git add tools/smoke.mjs
git commit -m "Add headless-Chrome smoke harness for Phase 1 verification

tools/smoke.mjs boots the real game via CDP, can inject a save fixture
(setItem-then-stub-then-reload, per CLAUDE.md), dispatches real key
events and DOM clicks, and reads state back through the game's own
save. Scenarios are named functions; each Phase 1 task adds one.
First scenario: the game boots with no page exceptions."
```

---

### Task 2: New tables + state shape (additive)

**Files:**
- Modify: `index.html` — add tables after `const OS_TIERS` (~line 979–991); extend `defaults()` (~1253) and `PERSIST` (~1274); bump `SAVE_VER` (~1214).

**Interfaces:**
- Produces (all inside the IIFE):
  - `AGENT_STATS = [{id:"quality",…},{id:"speed",…},{id:"stamina",…}]`, `ASTAT` (by id), `ASTAT_IDS`.
  - `AGENT_SLOTS = [{id:"model",stat:"quality",…},{id:"memory",stat:"stamina",…},{id:"compute",stat:"speed",…},{id:"tools",stat:null,…}]`, `ASLOT` (by id), `ASLOT_IDS`.
  - `QUEUE_TIERS = [{id:"backlog",name:"Backlog",D:10,os:0},…6 rows]`, `BAL` constants object, `HIRE_CAP`, `ILVL_CAP` (replaced), `OS_COSTS`.
  - `newAgent(nameObj, opts)` → agent object `{id, name, color, gear:{model:null,…}, inv:[], sanity, q, done, failed}`.
  - `starterItem(slotId)` → item `{id, slot, name, ilvl:10, patches:[], maxPatches:2}`.
  - `P.agents`, `P.queues`, `P.selectedAgent` persisted.
- Consumes: `AGENTS` (names/colors, line ~1159), `rand`, `pick`, `clamp`.

- [ ] **Step 1: Add the smoke scenario (fails until implemented)**

Append to `SCENARIOS` in `tools/smoke.mjs`:

```js
  async stateShape() {
    const s = await boot();
    assert(s.ver === 8, "SAVE_VER must be 8, got " + s.ver);
    assert(Array.isArray(s.agents) && s.agents.length === 1, "fresh save has exactly one agent (you)");
    const a = s.agents[0];
    for (const k of ["model", "memory", "compute", "tools"]) assert(a.gear[k] && a.gear[k].ilvl === 10, "agent zero starter " + k + " ilvl 10");
    assert(Array.isArray(a.inv), "agent has inv"); assert(typeof a.sanity === "number", "agent has sanity"); assert(a.q === 0, "agent seated in queue 0");
    assert(Array.isArray(s.queues) && s.queues.length === 1 && s.queues[0].tier === 0 && s.queues[0].seats === 1, "one Backlog queue with one seat");
    assert(s.selectedAgent === 0, "selectedAgent defaults to 0");
  },
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tools/smoke.mjs stateShape`
Expected: `FAIL assert: SAVE_VER must be 8, got 7`

- [ ] **Step 3: Add the tables** — insert directly after the `HIRE_CAP` line (~991), and delete the old `const HIRE_CAP=[1,2,4,6,7,7];`:

```js
  /* ============ Agents & Queues (docs/agents-and-queues.md) ============ */
  // Three stats, all derived from gear — no levels, no skill points. Balance numbers: doc "Balance model".
  const AGENT_STATS=[
    {id:"quality", lbl:"Quality", em:"🎯", color:"#c77dff", expl:"Quality — success chance vs the queue's difficulty (and crit). Fed by the Model slot."},
    {id:"speed",   lbl:"Speed",   em:"⚡", color:"#00e5ff", expl:"Speed — how fast tickets clear. Fed by the Compute slot."},
    {id:"stamina", lbl:"Stamina", em:"🧠", color:"#39ff14", expl:"Stamina — sanity pool and regen; failures drain it, zero means burnout. Fed by the Memory slot."},
  ];
  const ASTAT=Object.fromEntries(AGENT_STATS.map(s=>[s.id,s])), ASTAT_IDS=AGENT_STATS.map(s=>s.id);
  const AGENT_SLOTS=[
    {id:"model",   lbl:"Model",   em:"🤖", stat:"quality"},
    {id:"memory",  lbl:"Memory",  em:"🧠", stat:"stamina"},
    {id:"compute", lbl:"Compute", em:"⚙️", stat:"speed"},
    {id:"tools",   lbl:"Tools",   em:"🧰", stat:null},      // wildcard: credit multiplier + misc patches
  ];
  const ASLOT=Object.fromEntries(AGENT_SLOTS.map(s=>[s.id,s])), ASLOT_IDS=AGENT_SLOTS.map(s=>s.id);
  // Queue tiers: D = base difficulty; drops roll ilvl in [D, BAL.bandTop × next D]. Phase 1 only sells Backlog seats.
  const QUEUE_TIERS=[
    {id:"backlog",  name:"Backlog",         D:10,  os:0, em:"📥"},
    {id:"kanban",   name:"Kanban",          D:25,  os:1, em:"🗂"},
    {id:"jira",     name:"Jira",            D:45,  os:2, em:"📋"},
    {id:"pager",    name:"PagerDuty",       D:70,  os:3, em:"📟"},
    {id:"roadmap",  name:"The Roadmap",     D:100, os:4, em:"🗺"},
    {id:"monolith", name:"Legacy Monolith", D:140, os:5, em:"🏚"},
  ];
  const BAL={   // every tunable from tools/aq-sim.mjs, in one place
    floor:10, coeff:{model:1,memory:1,compute:1,tools:0.004},
    succK:1.25, succMax:0.95, durBase:4, durPerD:0.3, speedDiv:40, durMin:1.1, durMax:16, cooldown:0.7, surgeSpeed:0.15,
    payK:1.5, modPay:1.15, modD:0.12, modIlvl:0.12,
    drainC:0.3, drainWork:0.1, drainFail:3, regenK:0.02, sanityBase:50, sanityPerStamina:2,
    drop:0.10, bandTop:0.92, starterIlvl:10,
    hireBase:150, hireGrowth:3.2, seatBase:150, seatGrowth:2.2, seatTierMult:4,
    typeProg:0.09,   // fraction of agent zero's ticket one keypress completes (unchanged from today's mashCode)
  };
  const HIRE_CAP=[1,2,4,6,8,10];          // total agents incl. you, per OS tier
  const OS_COSTS=[0,4000,40000,400000,3000000,24000000];
  function queueTier(q){ return QUEUE_TIERS[q.tier]; }
  function queueD(q){ return queueTier(q).D*(1+(q.mods||0)*BAL.modD); }
  function queueBandTop(q){ const t=q.tier, next=QUEUE_TIERS[t+1]?QUEUE_TIERS[t+1].D:QUEUE_TIERS[t].D*1.4;
    return Math.min(ILVL_CAP[clamp(P.up.os,0,ILVL_CAP.length-1)], BAL.bandTop*next*(1+(q.mods||0)*BAL.modIlvl)); }
  function starterItem(slotId){ return {id:++P.itemSeq, slot:slotId, name:"Hand-me-down "+ASLOT[slotId].lbl, ilvl:BAL.starterIlvl, patches:[], maxPatches:2}; }
  function newAgent(who, q){
    const a={id:++P.agentSeq, name:who.name, color:who.color, gear:{}, inv:[], sanity:100, q:q||0, done:0, failed:0};
    for(const s of AGENT_SLOTS) a.gear[s.id]=starterItem(s.id);
    return a;
  }
```

Also replace the existing `const ILVL_CAP=[40,80,140,220,340,520];` (~line 1061) with `const ILVL_CAP=[30,55,85,125,175,9999];`. Keep every other old table for now (removed in Task 5/6).

- [ ] **Step 4: Extend `defaults()` and `PERSIST`; bump `SAVE_VER`**

In `defaults()` (~1253) add these keys to the returned object (leave the old ones in place until Task 5): after `toolbox:[], itemSeq:0, craftSlot:null,` insert

```js
      agentSeq:0, agents:null,   // seeded right after construction (newAgent needs P.itemSeq) — see below
      queues:[{tier:0,seats:1,mods:0,configs:[]}], selectedAgent:0,
```

Immediately after `let P=defaults();` (~1273) add:

```js
  function seedAgents(){ if(!P.agents||!P.agents.length){ P.agents=[newAgent({name:"you",color:"#eafff0"},0)]; } }
  seedAgents();
```

Add `"agentSeq","agents","queues","selectedAgent"` to `PERSIST` (after `"craftSlot"`). Change `const SAVE_VER=7;` to `const SAVE_VER=8;`. In `loadState()` after the `for(const k of PERSIST)` line add `seedAgents();` so a save is never agentless.

- [ ] **Step 5: Run both scenarios**

Run: `node tools/smoke.mjs boots && node tools/smoke.mjs stateShape`
Expected: `PASS` twice. Also open `index.html` in a browser once: the old game must still play (nothing consumes the new fields yet).

- [ ] **Step 6: Commit**

```bash
git add index.html tools/smoke.mjs
git commit -m "A&Q Phase 1: agent/queue tables and state shape (additive, SAVE_VER 8)

Adds AGENT_STATS/AGENT_SLOTS/QUEUE_TIERS/BAL/HIRE_CAP/OS_COSTS from the
balance model, newAgent()/starterItem(), and P.agents/P.queues/
P.selectedAgent (persisted). Old tables and fields stay until the loop
is cut over; SAVE_VER bumps to 8 now so no save straddles both shapes."
```

---

### Task 3: Per-agent math, worker loop cutover, drops into agent inventories

**Files:**
- Modify: `index.html` — `recompute()` (~1329–1356), `buildWorkers()`/`assignTask()`/`resolveTask()`/`tickWorker()`/`mashCode()` (~2560–2661), `dropHardware()`/`addHardwareItem()` (~2252–2278), `rollItem()` (~1083), `PATCH_DEFS` (~1025), `recomputeGear()` (~1097), keydown/click handlers (~2959, 2963), `tickProgress()` hp/regen lines (~2665).

**Interfaces:**
- Produces: `agentStats(a)` → `{quality, speed, stamina, tools}`; `agentMult(a)` writes `a.m = {chance:(D)=>…, dur:(D)=>…, payout:(D,q)=>…, sanityMax, regen}`; `recompute()` now loops agents; `rollItem(slotId, ilvl)`; `rollIlvl(q)`; `dropHardware(a, q)` puts the item in `a.gear[slot]` if empty else `a.inv` (cap 18, auto-scrap worst); `agentZero()` = `P.agents[0]`.
- `PATCH_DEFS` rewritten for the new slots (kept the same row shape `{slot, lbl, tiers, gate, fmt}` plus `kind`).
- Consumes: Task 2 tables.

- [ ] **Step 1: Add the smoke scenario**

```js
  // Two agents on Backlog: the hired one must earn credits idle (no typing), agent zero must not.
  async loopEarns() {
    const s0 = await boot({ fixture: s => {
      s.intro = false; s.credits = 0; s.earned = 0;
      s.agents.push({ id: 2, name: "bot", color: "#0ff", gear: Object.fromEntries(["model","memory","compute","tools"].map(k => [k, { id: 50, slot: k, name: "x", ilvl: 10, patches: [], maxPatches: 2 }])), inv: [], sanity: 100, q: 0, done: 0, failed: 0 });
      s.queues[0].seats = 2; s.up.hire = 1;
    }});
    assert(s0.agents.length === 2, "fixture has two agents");
    await sleep(30000);
    const s1 = await readSave();
    assert(s1.earned > 0, "hired agent earned nothing in 30s");
    assert(s1.agents[1].done + s1.agents[1].failed >= 3, "hired agent resolved <3 tickets in 30s");
    assert(s1.agents[0].done + s1.agents[0].failed === 0, "agent zero must not progress without typing");
    await type(3, 10);
    const s2 = await readSave();
    assert(s2.agents[0].done + s2.agents[0].failed >= 1, "typing 30 keys must resolve at least one ticket for agent zero");
  },
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tools/smoke.mjs loopEarns`
Expected: `FAIL` (agents[1].done is undefined / never increments — the loop still uses WK/P.stats).

- [ ] **Step 3: Rewrite `PATCH_DEFS`** — replace the whole `const PATCH_DEFS={…}` block (~1025–1041) with:

```js
  // Patches (affixes) for the four agent slots. Slot patches are a % boost to that slot's stat
  // contribution (a fully patched item ≈ ×1.6, the sim's craftBonus); generics are flat stat adds.
  const PATCH_DEFS={
    model_quality:  {slot:"model",   kind:"pct",  lbl:"Fine-Tuned",   tiers:[0.15,0.30,0.60], gate:[0,25,55], fmt:v=>"+"+Math.round(v*100)+"% Quality"},
    memory_stamina: {slot:"memory",  kind:"pct",  lbl:"Long-Context", tiers:[0.15,0.30,0.60], gate:[0,25,55], fmt:v=>"+"+Math.round(v*100)+"% Stamina"},
    compute_speed:  {slot:"compute", kind:"pct",  lbl:"Overclocked",  tiers:[0.15,0.30,0.60], gate:[0,25,55], fmt:v=>"+"+Math.round(v*100)+"% Speed"},
    tools_credit:   {slot:"tools",   kind:"credit",lbl:"Monetized",   tiers:[0.05,0.10,0.20], gate:[0,25,55], fmt:v=>"+"+Math.round(v*100)+"% credits"},
    gen_quality:    {slot:null, kind:"flat", statId:"quality", lbl:"Sharp",     tiers:[2,4,8], gate:[0,20,45], fmt:v=>"+"+Math.round(v)+" Quality"},
    gen_speed:      {slot:null, kind:"flat", statId:"speed",   lbl:"Snappy",    tiers:[2,4,8], gate:[0,20,45], fmt:v=>"+"+Math.round(v)+" Speed"},
    gen_stamina:    {slot:null, kind:"flat", statId:"stamina", lbl:"Resilient", tiers:[2,4,8], gate:[0,20,45], fmt:v=>"+"+Math.round(v)+" Stamina"},
    gen_regen:      {slot:null, kind:"regen", lbl:"Well-Rested", tiers:[0.10,0.20,0.35], gate:[0,20,45], fmt:v=>"+"+Math.round(v*100)+"% sanity regen"},
  };
```

Delete `LEGENDARIES` and `rollLegendary()` (~1044–1060) — Legendaries return with bounties in Phase 3. Delete `RETRO_NAMES` (~1011–1018). **Keep** `SLOTS`, `SLOT`, `slotUnlocked`, `slotUnlockHint` (~997–1009) and `P.equip`/`P.toolbox` for now: `buildToolbox()`/`renderToolbox()`/`renderStashList()` still read them at boot and are only rewritten in Tasks 5–6. Stub the old gamble so it can't build a broken item: replace the body of `rollForSlot(slotId,count)` (~2323–2336) with `return;` (Task 5 deletes it). Replace `rollItem()` (~1083–1089) with:

```js
  const ERA_NAMES=[["Orange II","Trash-80","IBM PC/XT Clone"],["386SX Turbo","Packard Smell","VESA Local Bus"],["Pentium Overdrive","SoundBlaster-Compatible","ATI Rage"],
    ["ThinkPad-Alike","GeForce (Bootleg)","Athlon XP"],["Quantum Flux Core","Photonic Array","Neuro-Cache"],["Singularity Core","Graviton Lattice","Zero-Point Module"]];
  function rollIlvl(q){ const lo=queueTier(q).D, hi=Math.max(lo,queueBandTop(q)); return Math.round(rand(lo,hi)); }
  function rollItem(slotId, ilvl){
    const era=ERA_NAMES[clamp(P.up.os,0,ERA_NAMES.length-1)];
    return {id:++P.itemSeq, slot:slotId, name:pick(era)+" "+ASLOT[slotId].lbl, ilvl, patches:[], maxPatches:initialMaxPatches(ilvl)};
  }
```

Replace `itemPower()` (~1090), `countCustomBuiltPlus()` and `recomputeGear()` (~1094–1124) with the per-agent math below, and shrink the `GEAR` object (~1092) to `const GEAR={setBonus:1};` (a shim — `renderToolbox` still reads `GEAR.setBonus` until Task 5 rewrites it):

```js
  // Per-agent derived stats. Never persisted: recompute() rewrites a.m for every agent.
  function agentStats(a){
    const out={quality:BAL.floor, speed:BAL.floor, stamina:BAL.floor, tools:1, regen:0};
    for(const s of AGENT_SLOTS){ const it=a.gear[s.id]; if(!it) continue;
      let pct=0, credit=0;
      for(const p of it.patches||[]){ const d=PATCH_DEFS[p.id]; if(!d) continue;
        if(d.kind==="pct") pct+=p.value; else if(d.kind==="credit") credit+=p.value;
        else if(d.kind==="flat") out[d.statId]+=p.value; else if(d.kind==="regen") out.regen+=p.value; }
      if(s.stat) out[s.stat]+=it.ilvl*BAL.coeff[s.id]*(1+pct);
      else out.tools+=it.ilvl*BAL.coeff.tools+credit;
    }
    return out;
  }
  function agentMult(a){
    const st=agentStats(a), pres=1+P.equity*0.02, focus=focusOn?(1+FOCUS.credit):1;
    a.m={ st,
      chance:D=>clamp(0.5+(st.quality/D-1)*BAL.succK,0,BAL.succMax),
      dur:D=>clamp((BAL.durBase+BAL.durPerD*D)/(1+st.speed/BAL.speedDiv),BAL.durMin,BAL.durMax),
      payout:(D,q)=>Math.pow(D,BAL.payK)*Math.pow(BAL.modPay,q.mods||0)*st.tools*pres*focus,
      sanityMax:BAL.sanityBase+BAL.sanityPerStamina*st.stamina,
      regen:BAL.regenK*st.stamina*(1+st.regen)*(focusOn?(1+FOCUS.regen):1),
    };
    if(a.sanity>a.m.sanityMax) a.sanity=a.m.sanityMax;
    return a.m;
  }
  const agentZero=()=>P.agents[0];
```

- [ ] **Step 4: Cut `recompute()` over** — replace the body of `recompute()` (~1329–1356) with:

```js
  function recompute(){
    for(const a of P.agents) agentMult(a);
    MULT.workers=P.agents.length;   // MULT shrinks to what the old UI still reads; removed fully in Task 5
    MULT.passive=0;
  }
```

`updateHpMax()` and the `MULT.hpBonus` uses go away in Task 5; for now leave `updateHpMax` defined but unused.

- [ ] **Step 5: Cut the worker loop over** — replace `buildWorkers()`, `assignTask()`, `resolveTask()`, `tickWorker()` and `mashCode()` (~2560–2661) with:

```js
  const WK=[];   // one worker per P.agents entry, same index. Slot 0 = "you" (manual) → terminal pane; 1+ → agents app
  function buildWorkers(){
    const autoList=$("#agentList"), manualWrap=$("#manualWrap");
    autoList.innerHTML=""; if(manualWrap) manualWrap.innerHTML=""; WK.length=0;
    const nAuto=P.agents.length-1;
    autoList.style.gridTemplateRows=`repeat(${Math.max(1,nAuto)},1fr)`;
    P.agents.forEach((a,i)=>{
      const manual=(i===0);
      const el=document.createElement("div"); el.className="agent"+(manual?" manual":"");
      el.innerHTML=`<div class="ah"><span class="nm" style="color:${a.color};text-shadow:0 0 8px ${a.color}"></span>
        <span class="tk"></span><span class="sTag"></span><span class="diff"></span></div>
        <div class="code"></div><div class="prog"><i></i></div>`;
      (manual&&manualWrap?manualWrap:autoList).appendChild(el);
      const w={i,manual,el,nm:el.querySelector(".nm"),tk:el.querySelector(".tk"),sTag:el.querySelector(".sTag"),
        dEl:el.querySelector(".diff"),code:el.querySelector(".code"),prog:el.querySelector(".prog i"),
        task:null,elapsed:0,cooldown:0,flashT:0,buf:pick(SNIPPETS)+"\n\n",pos:0,shown:"",acc:0};
      w.nm.textContent=manual?"you ⌨️":a.name; WK.push(w);
    });
  }
  const workerAgent=w=>P.agents[w.i];
  const workerQueue=w=>P.queues[workerAgent(w).q]||P.queues[0];
  function assignTask(w){
    const a=workerAgent(w), q=workerQueue(w), D=queueD(q);
    const [name]=pick(TASKS);
    if(!a.m) agentMult(a);
    const dur=a.m.dur(D);
    w.task={name,D,dur,q}; w.elapsed=0; w.flashT=0;
    w.el.classList.remove("win","fail","crit");
    const t=queueTier(q);
    w.tk.textContent=name; w.sTag.textContent=t.em+" "+t.name; w.sTag.style.color="#00e5ff";
    w.prog.style.background=`linear-gradient(90deg,#00e5ff,#fff2)`;
    const stars=clamp(Math.round(a.m.chance(D)*5),1,5); w.dEl.textContent="★".repeat(stars); w.dEl.title=Math.round(a.m.chance(D)*100)+"% success";
    termLine("t-dim","→",a.name+" started ‹"+name+"›");
  }
  function resolveTask(w){
    const a=workerAgent(w), {name,D,q}=w.task;
    if(!a.m) agentMult(a);
    const chance=(P.intro&&w.manual)?1:a.m.chance(D);
    const drainWork=D*BAL.drainC*BAL.drainWork;
    if(Math.random()<chance){
      const crit=Math.random()<0.05?3:1; if(crit>1)P.crits++;
      const cr=Math.round(a.m.payout(D,q)*crit), xp=Math.round((D+6)*crit);
      addXp(xp); P.credits+=cr; P.earned+=cr; checkReveal();
      P.plot+=D*0.5+4; P.streak++; if(P.streak>P.bestStreak)P.bestStreak=P.streak;
      P.tasksDone++; a.done++; const locBefore=P.loc; P.loc+=Math.round(rand(20,120)); if(Math.random()<.3)P.deploys++;
      a.sanity=clamp(a.sanity-drainWork,0,a.m.sanityMax);
      w.el.classList.add(crit>1?"crit":"win"); w.flashT=0.6; spawnArc(crit>1?"#ffb000":"#39ff14");
      termLine("t-ok","✓",a.name+(crit>1?" CRIT ":" ")+"cleared ‹"+name+"›  +"+money(cr));
      if(Math.random()<.8) toast((crit>1?"💥 CRIT · ":"✓ ")+name,"+"+money(cr)+" · "+queueTier(q).name,crit>1?"#ffb000":"#00e5ff","grind");
      if(Math.random()<BAL.drop) dropHardware(a,q);
      grantMaterials(q,locBefore);
    } else {
      const dmg=drainWork+D*BAL.drainC*BAL.drainFail;   // success drains 0.1·D·c, failure (0.1+3)·D·c → expected per ticket = D·c·(0.1+3·(1−chance)), exactly the sim's
      a.sanity=clamp(a.sanity-dmg,0,a.m.sanityMax); P.streak=0; P.tasksFailed++; a.failed++; addXp(Math.round((D+6)*0.2));
      w.el.classList.add("fail"); w.flashT=0.6; spawnArc("#ff2b5e"); if(w.manual) flashHp();
      termLine("t-bad","✗",a.name+" FAILED ‹"+name+"›  -"+Math.round(dmg)+" sanity  (streak reset)");
      toast("💥 "+name+" failed","-"+Math.round(dmg)+" sanity · "+a.name+"'s Quality too low for "+queueTier(q).name,"#ff2b5e","grind");
      if(a.sanity<=0) burnout(a);
    }
    w.task=null; w.cooldown=rand(0.4,1.0);
  }
  function revealChars(w,n){   // unchanged
    while(n-->0){ if(w.pos>=w.buf.length){ w.buf=pick(SNIPPETS)+"\n\n"; w.pos=0; } w.shown+=w.buf[w.pos++]; }
    let lines=w.shown.split("\n"); if(lines.length>9){ lines=lines.slice(-9); w.shown=lines.join("\n"); }
    w.code.innerHTML=lines.map(hl).join("<br>");
  }
  function tickWorker(w,dt){
    const a=workerAgent(w); if(!a.m) agentMult(a);
    a.sanity=clamp(a.sanity+dt*a.m.regen,0,a.m.sanityMax);
    if(a.down){ if(a.sanity>=a.m.sanityMax*0.5){ a.down=false; termLine("t-info","☕",a.name+" is back from the coffee break"); } else return; }
    if(!w.manual){ w.acc+=dt*(12+surge*6); let n=w.acc|0; w.acc-=n; if(n>0) revealChars(w,n); }
    if(w.flashT>0){ w.flashT-=dt; if(w.flashT<=0) w.el.classList.remove("win","fail","crit"); }
    if(!w.task){ w.cooldown-=dt; if(w.cooldown<=0) assignTask(w); return; }
    if(!w.manual) w.elapsed+=dt*(1+BAL.surgeSpeed*(surge-1));   // typing is a small team-wide boost, not a 4× lever
    w.prog.style.width=clamp(w.elapsed/w.task.dur*100,0,100)+"%";
    if(w.elapsed>=w.task.dur) resolveTask(w);
  }
  function mashCode(){   // typing is the ONLY thing that advances agent zero's ticket
    const w=WK[0]; if(!w) return; revealChars(w,(2+Math.random()*3)|0);
    if(w.task && !workerAgent(w).down){ w.elapsed+=w.task.dur*BAL.typeProg; if(w.elapsed>=w.task.dur) resolveTask(w); }
  }
```

Replace `burnout()` (~2550–2557) with the per-agent version (rogue proper is Phase 2):

```js
  function burnout(a){
    P.burnouts++; a.down=true; a.sanity=0; P.streak=0;
    celebrate("🔥 "+a.name.toUpperCase()+" BURNED OUT","#ff2b5e"); if(a===agentZero()) flashHp();
    toast("🔥 Burnout",a.name+" is off the board until sanity is back to 50%","#ff2b5e","progress");
    termLine("t-bad","☠",a.name+" — sanity hit zero, forced coffee break"); save();
  }
```

`down` is runtime-only; add it to nothing persisted (a reload simply brings the agent back at whatever sanity it saved).

- [ ] **Step 6: Drops go to the agent** — replace `addHardwareItem()` and `dropHardware()` (~2252–2257, 2267–2278) with the code below. **Keep `enforceToolboxCap()`** (~2258–2266) as-is until Task 5 — the legacy Unequip/IDE handlers still call it.

```js
  const INV_CAP=18;
  function addItemToAgent(a,item){
    if(!a.gear[item.slot]){ a.gear[item.slot]=item; recompute(); return "equipped"; }
    a.inv.push(item); enforceInvCap(a); return "stashed";
  }
  function enforceInvCap(a){
    while(a.inv.length>INV_CAP){
      let worst=0; for(let i=1;i<a.inv.length;i++) if(a.inv[i].ilvl<a.inv[worst].ilvl) worst=i;
      const gone=a.inv.splice(worst,1)[0], refund=salvageValue(gone); P.credits+=refund;
      termLine("t-dim","♻",a.name+"'s inventory full, auto-scrapped "+gone.name+" for "+money(refund));
    }
  }
  function dropHardware(a,q){
    const slotId=pick(ASLOT_IDS), item=rollItem(slotId, rollIlvl(q));
    const where=addItemToAgent(a,item);
    toast("🧰 "+a.name+" found gear",item.name+" (Lv "+item.ilvl+")"+(where==="equipped"?" — equipped":" → inventory"),"#4d8cff","grind");
    termLine("t-git","🧰",a.name+" found "+item.name+" (Lv "+item.ilvl+")"+(where==="equipped"?" and equipped it":""));
  }
```

Change `grantMaterials(stat,locBefore)` (~2369) signature to `grantMaterials(q,locBefore)` and its body's stat checks: `materialAttempt("hotfix",0.2,true)`, `materialAttempt("refactor",0.2,true)`, and the merge gate `P.level>=40` → `q.tier>=2`. Delete `addLoot()` (~2242) and the `if(Math.random()<.16){…addLoot()}` branch is already gone from the new `resolveTask`.

- [ ] **Step 7: Input handlers and the per-frame HUD** — in the keydown handler (~2959) and the click handler (~2963) delete `for(const w of WK) if(!w.manual&&w.task) w.elapsed+=0.05;` (typing no longer directly advances agents) and `P.plot+=0.3;`. In `tickProgress()` (~2664) replace the first line `P.hp=clamp(P.hp+dt*MULT.regen,0,P.hpMax);` with nothing (sanity regen now lives in `tickWorker`), and replace the `hpPct` block with:

```js
    const z=agentZero(); if(!z.m) agentMult(z);
    const hpPct=clamp(z.sanity/z.m.sanityMax*100,0,100);
```

(`P.hp`/`P.hpMax` are deleted in Task 5; `drawGauge` in Task 5 switches to `agentZero()` too — for now change `drawGauge`'s `const val=clamp(P.hp/P.hpMax,0,1);` to `const z=agentZero(); const val=z.m?clamp(z.sanity/z.m.sanityMax,0,1):1;`.)

In `buy()` for `hire` (~1436) the call `buildWorkers()` stays; the hire branch itself is rewritten in Task 4. In `doPrestige()` (~1793) and boot (~3037) the calls `buildWorkers(); … WK.forEach(w=>assignTask(w))` still work with the new WK.

- [ ] **Step 8: Run the scenario, then all three**

Run: `node tools/smoke.mjs loopEarns && node tools/smoke.mjs stateShape && node tools/smoke.mjs boots`
Expected: `PASS` ×3. If `loopEarns` fails on "agent zero must not progress", check nothing else calls `mashCode()` or bumps `WK[0].elapsed`.

- [ ] **Step 9: Commit**

```bash
git add index.html tools/smoke.mjs
git commit -m "A&Q Phase 1: per-agent stats and worker loop on the Backlog queue

recompute() now derives a.m (chance/dur/payout/sanityMax/regen) per agent
from its four gear slots; assignTask/resolveTask use the queue's D with
the sim's success/duration/payout/sanity formulas; drops roll ilvl from
the queue band into the agent's own gear or inventory; burnout is
per-agent (rogue proper lands in Phase 2). Agent zero only moves when
you type; surge is a small team-wide speed boost. PATCH_DEFS rewritten
for Model/Memory/Compute/Tools."
```

---

### Task 4: Store cutover — hires, seats, OS, unlocks

**Files:**
- Modify: `index.html` — `UPG` (~1126–1147), `upCost()`/`osLock()`/`buy()` (~1376–1442), `autoBuyCheapest()` (~1443), `APPS.agents.unlocked` (~1940), `renderStore()` skill/tier branches (~1760–1770), `MACH`/`MODEL`/`HIRE` tables (~957–978).

**Interfaces:**
- Produces: `UPG` rows `{id:"hire",kind:"hire"}`, `{id:"seat",kind:"seat"}`, `{id:"os",kind:"tier",tiers:OS_TIERS}` (OS tiers now carry `cost` from `OS_COSTS`), unlocks (`u_status,u_achv,u_tele,u_inv,u_equip,u_ide,u_globe`), `notify`, `hype`, `offline`, `autoBuy`. `hireCost()`, `seatCost(q)`. `buy(u)` for `hire` pushes `newAgent(pick(AGENTS))` and seats it in the first queue with a free seat.
- Consumes: Task 2/3.

- [ ] **Step 1: Smoke scenario**

```js
  // Buying "Hire an Agent" from the Store adds a starter-kitted agent seated on Backlog, and the seat card gates it.
  async storeHire() {
    const s0 = await boot({ fixture: s => { s.intro = false; s.credits = 10000; s.reveal = { credits: true, shop: true, store: true }; s.maxCredits = 10000; s.up.os = 1; /* DOS caps hires at 1 */ }});
    assert(s0.agents.length === 1, "start with one agent");
    let r = await click('[data-upg="hire"] .buy'); assert(r === "ok", "hire card present");
    await sleep(3500); let s1 = await readSave();
    assert(s1.agents.length === 1, "hire must be blocked while Backlog has one seat (no free seat)");
    r = await click('[data-upg="seat"] .buy'); assert(r === "ok", "seat card present"); await sleep(500);
    r = await click('[data-upg="hire"] .buy'); await sleep(3500); s1 = await readSave();
    assert(s1.queues[0].seats === 2, "seat bought"); assert(s1.agents.length === 2, "hire bought after seat");
    assert(s1.agents[1].gear.model.ilvl === 10 && s1.agents[1].q === 0, "hire has starter kit and sits on Backlog");
    assert(s1.credits < 10000 - 150, "credits were spent");
  },
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tools/smoke.mjs storeHire`
Expected: `FAIL assert: hire card present` (cards have no `data-upg` yet and there is no seat card).

- [ ] **Step 3: Replace the tier tables and `UPG`** — delete `MACH`, `MODEL`, `HIRE` (~957–978). Give `OS_TIERS` costs from the model: change each row's `cost` to `OS_COSTS[i]` — simplest is to keep the literal table and edit the numbers to `0, 4000, 40000, 400000, 3000000, 24000000`, then delete the separate `OS_COSTS` constant from Task 2. Replace the whole `const UPG=[…]` with:

```js
  function hireCost(){ return Math.round(BAL.hireBase*Math.pow(BAL.hireGrowth,P.agents.length-1)); }
  function seatCost(q){ return Math.round(BAL.seatBase*Math.pow(BAL.seatGrowth,q.seats-1)*Math.pow(BAL.seatTierMult,q.tier)); }
  function freeSeatQueue(){ return P.queues.find((q,qi)=>q.seats>P.agents.filter(a=>a.q===qi).length)||null; }
  const UPG=[
    {id:"hire",    kind:"hire",  emoji:"👥",name:"Hire an Agent",     cat:"Team",  fx:()=>P.agents.length+" on the team · a new hire ships with a Junior starter kit"+(freeSeatQueue()?"":" · needs a free seat")},
    {id:"seat",    kind:"seat",  emoji:"🪑",name:"Backlog Seat",      cat:"Team",  fx:()=>"seats on the Backlog: "+P.queues[0].seats+" → "+(P.queues[0].seats+1)},
    {id:"notify",  kind:"tier",  emoji:"🔔",name:"Push Notifications",cat:"Getting Started", tiers:[{cost:0},{cost:40,name:"ON"}],  fx:i=>i?"toast pop-ups are ON — mute types below in the Store":"pop-up toasts for wins & finds (routine logs still go to the Terminal)"},
    {id:"hype",    kind:"tier",  emoji:"🎉",name:"Hype Banners",      cat:"Getting Started", tiers:[{cost:0},{cost:120,name:"ON"}], fx:i=>i?"flying hype text on big wins — mute below in the Store":"flying meme banners across the screen on unlocks & milestones"},
    {id:"u_status",kind:"unlock",emoji:"📟",name:"Status Readout",    cost:25,   unlocks:"status",      meme:"STATUS",       cat:"Getting Started", fx:()=>"reveal your sheet — sanity, streak, level"},
    {id:"u_achv",  kind:"unlock",emoji:"🏆",name:"Trophy Case",       cost:150,  unlocks:"achievements",meme:"ACHIEVEMENTS", cat:"Getting Started", fx:()=>"open the Achievements app — and retro-unlock every one you've already earned"},
    {id:"u_tele",  kind:"unlock",emoji:"📊",name:"Install Telemetry", cost:400,  unlocks:"telemetry",   meme:"TELEMETRY",    cat:"Getting Started", fx:()=>"reveal the live charts panel"},
    {id:"u_inv",   kind:"unlock",emoji:"🧰",name:"Open Inventory",    cost:500,  unlocks:"inventory",   meme:"INVENTORY",    cat:"Getting Started", fx:()=>"reveal each agent's inventory — the gear they've found"},
    {id:"u_equip", kind:"unlock",emoji:"🔧",name:"Equip Hardware",    cost:700,  unlocks:"equipment",   meme:"HARDWARE",     cat:"Getting Started", fx:()=>"reveal Equipment — gear up the selected agent"},
    {id:"u_ide",   kind:"unlock",emoji:"🛠️",name:"Launch the IDE",    cost:1000, unlocks:"ide",         meme:"THE IDE",      cat:"Getting Started", fx:()=>"reveal the IDE — craft & patch gear"},
    {id:"u_globe", kind:"unlock",emoji:"🌐",name:"Go Global",         cost:1400, unlocks:"globe",       meme:"GLOBAL DEPLOY", cat:"Getting Started", fx:()=>"reveal the global deploy mesh"},
    {id:"os",      kind:"tier",  emoji:"🖥️",name:"Upgrade OS",        cat:"Rigs", tiers:OS_TIERS,fx:i=>"now on "+OS_TIERS[i].name+(i<OS_TIERS.length-1?" · next: "+OS_TIERS[i+1].name+" (+hires, higher item levels)":" (final)")},
    {id:"offline", kind:"tier",  emoji:"🌙",name:"Cloud Sync",        cat:"Automation", reqOs:2, tiers:[{cost:0},{cost:2500}], fx:i=>i?"earning credits while away (up to 8h)":"earn credits while the tab is closed"},
    {id:"autoBuy", kind:"tier",  emoji:"🛒",name:"Auto-Buyer",        cat:"Automation", reqOs:3, tiers:[{cost:0},{cost:45000}], fx:i=>i?"auto-buys the cheapest seat/hire":"reinvest credits automatically"},
  ];
```

In `defaults()` replace the `up:{…}` object with `up:{hire:0,seat:0,notify:0,hype:0,u_tele:0,u_globe:0,u_status:0,u_achv:0,u_inv:0,u_equip:0,u_ide:0,os:0,offline:0,autoBuy:0}` and delete `unlockedStats:["coding"]`, `missions:[], sprintConfig:0, missionSeq:0,` and `unlocked.missions`. Remove `"missions","sprintConfig","missionSeq","unlockedStats"` from `PERSIST`.

- [ ] **Step 4: `upCost`, `osLock`, `buy`** — replace `upCost()` (~1376–1381) with:

```js
  function upCost(u){
    if(u.kind==="hire"){ return P.agents.length>=HIRE_CAP[HIRE_CAP.length-1]?null:hireCost(); }   // OS caps are osLock()'s job, so the card shows 🔒 Win 3.1 rather than MAX
    if(u.kind==="seat"){ return seatCost(P.queues[0]); }
    if(u.kind==="unlock"){ return P.up[u.id]>=1?null:u.cost; }
    const nxt=P.up[u.id]+1; return u.tiers[nxt]?u.tiers[nxt].cost:null;   // tier
  }
```

Replace `osLock()` (~1383–1388) with:

```js
  function osLock(u){   // OS tier index the NEXT purchase of u needs, or null if not locked
    let need=null;
    if(u.kind==="hire") need=HIRE_CAP.findIndex(c=>c>=P.agents.length+1);   // -1 only past the last cap, which upCost already nulls
    else if(u.reqOs!=null) need=u.reqOs;
    return (need!=null && need>P.up.os)?need:null;
  }
```

In `buy()` (~1401): replace the `else if(u.kind==="skill"){…}` branch with:

```js
    } else if(u.kind==="hire"){
      const q=freeSeatQueue(); if(!q){ P.credits+=c; toast("🪑 No free seat","Buy a seat first","#ffb000","system"); return; }
      const who=pick(AGENTS.filter(x=>!P.agents.some(a=>a.name===x.name)))||pick(AGENTS);
      const a=newAgent(who,P.queues.indexOf(q)); P.agents.push(a); P.up.hire++;
      recompute(); buildWorkers(); applyLayout(); assignTask(WK[WK.length-1]);
      toast("👥 Hired — "+a.name,"seated on "+queueTier(q).name+" with a starter kit","#39ff14"); termLine("t-git","👥","hired "+a.name);
    } else if(u.kind==="seat"){
      P.queues[0].seats++; P.up.seat++;
      toast("🪑 New seat","Backlog now seats "+P.queues[0].seats,"#00e5ff"); termLine("t-git","🪑","added a Backlog seat");
```

and in the final `else {` branch (~1434–1440) change only the line `if(u.id==="hire"){ recompute(); buildWorkers(); applyLayout(); } else recompute();` to `recompute();` — keep `const lvl=P.up[u.id];`, the `label` line, the `termLine` and the `toast` exactly as they are. In `buildShop()` (~1470) add `card.dataset.upg=u.id;` right after `card.className="card";`. In `renderStore()` (~1762–1765) replace the `if(u.kind==="repeat")…else if(u.kind==="skill")…` chain with:

```js
      if(u.kind==="hire"){ s.lv.textContent=P.agents.length+"/"+HIRE_CAP[P.up.os]; }
      else if(u.kind==="seat"){ s.lv.textContent=P.queues[0].seats+" seats"; }
      else if(u.kind==="unlock"){ s.lv.textContent=lvl?"✓":""; }
      else { s.lv.textContent=lvl?("· "+(u.tiers[lvl].name||("T"+lvl))):""; }
```

and the `MAX`/`OWNED` label line to `s.btn.textContent=(u.kind==="hire")?"MAX":"OWNED";`. `isRevealed()` (~1391): change `if(u.cat==="Getting Started" && u.kind!=="unlock") return true;` to `if(u.cat==="Team") return true;`. `autoBuyCheapest()` (~1443): it already skips Automation and uses `upCost`/`osLock`, no change. `APPS.agents.unlocked` (~1940): `()=>P.agents.length>=2`. **`applyUnlocks()` (~2183–2188) reads `P.unlockedStats`, which this task deletes — replace its body with just `applyLayout();`** (the stat-chip loop is dead once skills are gone; `buildHUD`'s chips are removed in Task 5). **`renderStatSheet()` (~2811–2819) also reads `P.unlockedStats` every frame** — replace both `P.unlockedStats.includes(s.id)` expressions with `true` (Task 5 rewrites the whole function; without this edit `guard("charts")` swallows a TypeError and the gauge/spark freeze).

- [ ] **Step 5: Run**

Run: `node tools/smoke.mjs storeHire && node tools/smoke.mjs loopEarns && node tools/smoke.mjs boots`
Expected: `PASS` ×3.

- [ ] **Step 6: Commit**

```bash
git add index.html tools/smoke.mjs
git commit -m "A&Q Phase 1: Store sells hires and Backlog seats; Machine/Model/Skill tiers removed

Hire is its own line (cost 150·3.2^n, capped per OS by HIRE_CAP, needs a
free seat, ships a starter kit and seats the agent); Backlog seats are a
separate line. OS tier costs come from the balance model. New Machine,
AI Model, Learn a Skill, Espresso, Autocomplete Assist, Mission Board and
Auto-Allocate are gone from the Store."
```

---

### Task 5: Remove the old global systems (stats, HP, equipment, toolbox, missions) and rewire prestige/offline/achievements/telemetry

**Files:**
- Modify: `index.html` — `STATS`/`STAT`/`STAT_IDS`/`TASKS` stat column (~890–934), HUD stat chips (`buildHUD` ~1920, `#statChips` markup ~741, `spStat` ~722), `allocate`/`updateSPui`/`statUp` (~1783–1789, 2240), `tickProgress` stat/SP lines (~2669, 2695–2699), `buildStatSheet`/`renderStatSheet`/`STAT_EXPL` (~2794–2819), `SLOTS` (~997–1006), `equipItem`…`rollForSlot` (~2279–2336), `buildToolbox` Equipment/Inventory/Missions sections (~1510–1597), `renderToolbox` (~1722–1745), `renderStashList` (~1602), mission code (~2461–2527, `refreshBoard` at boot ~3016), `levelUp`/`stageAdvance` (~2528–2549), `updateHpMax` (~1328), `doPrestige`/`equityGain`/`canPrestige` (~1790–1806), `offlineEarnings` (~2994), `ACH` (~1808), `unlockAll` (~1279), `defaults()` old fields.

**Interfaces:**
- Produces: `P.hp/hpMax/stats/sp/equip/toolbox/missions` gone; `equityGain()` = `floor(sqrt(earned/15000) + highestQueueTier)`; `canPrestige()` = `P.earned>=20000 && equityGain()>=1`; `offlineEarnings()` sums auto-agents' expected rate; `ACH` rewritten; stat sheet shows agent zero's three stats; `buildToolbox()` builds only the IDE for now (Equipment/Inventory get rebuilt per-agent in Task 6).
- Consumes: Tasks 2–4.

- [ ] **Step 1: Smoke scenario** — every app open, 45 s of play with typing, no exceptions, old fields absent:

```js
  async noOldSystems() {
    const s0 = await boot({ fixture: s => { s.intro = false; s.credits = 5000; s.maxCredits = 5000; s.reveal = { credits: true, shop: true, store: true };
      s.unlocked = { telemetry: true, globe: true, status: true, inventory: true, equipment: true, ide: true, achievements: true };
      s.up.os = 1; s.up.u_achv = 1; }});
    for (const k of ["hp", "hpMax", "stats", "sp", "equip", "toolbox", "missions", "unlockedStats"]) assert(!(k in s0), "old field still persisted: " + k);
    await type(2, 20); await sleep(25000);
    const s1 = await readSave();
    assert(s1.earned > 0, "earned nothing");
    const open = await ev(`[...document.querySelectorAll('.panel')].filter(p=>getComputedStyle(p).display!=='none').map(p=>p.dataset.app)`);
    for (const app of ["terminal", "status", "store", "ide", "telemetry", "achievements", "deploy_mesh"]) assert(open.includes(app), "app not visible: " + app);
    assert(typeof s1.achv === "object", "achievements object present");
  },
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tools/smoke.mjs noOldSystems`
Expected: `FAIL assert: old field still persisted: hp`

- [ ] **Step 3: Delete the stat system** — remove `STATS`, `STAT`, `STAT_IDS` (~894–902) and `STAT_EXPL`, `buildStatSheet`, `renderStatSheet` (~2794–2819); replace them with an agent-zero sheet:

```js
  let ssRowEls={};
  function buildStatSheet(){
    const wrap=$("#ssBars"); if(!wrap) return; wrap.innerHTML=""; ssRowEls={};
    for(const s of AGENT_STATS){
      const row=document.createElement("div"); row.className="ssRow"; row.title=s.expl;
      row.innerHTML=`<span class="ssn" style="color:${s.color}">${s.lbl}</span><span class="ssbar"><i style="background:${s.color};box-shadow:0 0 6px ${s.color}"></i></span><span class="ssv">0</span>`;
      wrap.appendChild(row); ssRowEls[s.id]={row,bar:row.querySelector("i"),v:row.querySelector(".ssv")};
    }
  }
  function renderStatSheet(){
    const z=agentZero(); if(!z.m) agentMult(z); const st=z.m.st, max=Math.max(1,...ASTAT_IDS.map(id=>st[id]));
    for(const s of AGENT_STATS){ const el=ssRowEls[s.id]; if(!el) continue; el.bar.style.width=clamp(st[s.id]/max*100,0,100)+"%"; el.v.textContent=Math.round(st[s.id]); }
  }
```

`TASKS` (~905–934): keep the array but it is now names only — leave the `[name, stat]` pairs in place (the second element is ignored by `assignTask`, which reads `pick(TASKS)[0]`). In `buildHUD()` (~1920–1935) delete these four things: the line `const wrap=$("#statChips"); wrap.innerHTML="";`, the line `HUD.chip={};`, the whole `STATS.forEach(s=>{…});` block, and `$("#g_stages")` stays; in the markup delete the `<div class="hud-block stats" id="statChips"></div>` line (~741) and the `spStat` div (~722). Delete `allocate()`, `updateSPui()` (~1783–1789), `statUp()` (~2240) and every call to them (`buy`, `doPrestige`, boot's `updateSPui();`, `tickProgress`'s `updateSPui();` and the `for(const id of STAT_IDS) HUD.chip…` line, the `autoAlloc` block and the `seenTips.sp` nudge in `tickProgress`). In `cacheUI()` remove `"s_sp"` and `"spStat"`. In `defaults()` delete `stats`, `sp`, `hp`, `hpMax`, `seenTips.sp`; in `PERSIST` delete `"hp","hpMax","stats","sp"`. Delete `updateHpMax()` and its call in `levelUp()`; `levelUp()` becomes:

```js
  function levelUp(){
    const before=titleFor();
    P.xp-=P.xpNeed; P.level++; P.xpNeed=Math.round(P.xpNeed*1.10+18);
    const nt=titleFor();
    if(nt!==before) celebrate("NEW RANK · "+nt,"#ffb000");
    toast("⭐ Level "+P.level+" — "+nt,"a new title for the résumé","#ffb000","progress");
    termLine("t-warn","🎉","LEVEL UP → Lv "+P.level+" "+nt);
    HUD.title.textContent=nt; save();
  }
```

In `stageAdvance()` delete `P.hp=P.hpMax;` and change `addXp(Math.round(30*(1+P.stage*.1)))` to `addXp(30)` (stages are story only).

- [ ] **Step 4: Delete global equipment/toolbox/missions** — remove `SLOTS`/`TOOLBOX_CAP` (~997–1019), `equipItem`, `equipFromToolbox`, `decommissionItem`, `sendToCraftSlot`, `returnCraftSlotToToolbox`, `equipFromCraftSlot`, `rollCost`, `rollForSlot` (~2279–2336) — Task 6 re-adds per-agent versions. Remove the whole missions section (~2461–2527: `MISSION_DEFS` … `missionCrunch`), `renderMissionBoard()` (~1698–1721), the `refreshBoard()` bootstrap line at boot (~3016), the `progressMissions(...)` call is already gone from `resolveTask`, the Missions app row in `APPS`, the `#missionsPanel` markup (~794–797), and `missions` from `WIN_LAYOUT` (move its rows to `achievements` so column 1 still totals `WIN_ROWS`: `achievements:{c:1,r:5,h:2,z:11}` and drop the old `achievements` row in column 2, giving `inventory` `h:4` there). In `buildToolbox()` delete the Equipment, Missions and Inventory sections, keeping only the IDE bench + materials (the function now only touches `ideBody`; guard `if(!ideBody) return;`). In `renderToolbox()` keep only `renderMaterials(); renderIdeCard();`. Delete `renderStashList()` and `equipCat`; replace the whole body of `dropOnBench(payload)` with `return;` (Task 6 rewrites it — its old body calls the deleted `sendToCraftSlot`). In `defaults()` delete `equip`, `toolbox`; in `PERSIST` delete `"equip","toolbox"`. In `loadState()` delete `for(const s of SLOTS) …`. `unlockAll()` (~1279): drop `missions:true` and the `unlockedStats` assignment. In `renderIdeCard()` replace `SLOT[it.slot]` with `ASLOT[it.slot]` (both uses) and drop the equip/return buttons' listeners for now (Task 6 rewires them): set `acts.innerHTML=""` in the has-item branch.

- [ ] **Step 5: Prestige, offline, achievements** — replace `equityGain`/`canPrestige` (~1791–1792):

```js
  function highestQueueTier(){ return P.queues.reduce((m,q)=>Math.max(m,q.tier),0); }
  function equityGain(){ return Math.floor(Math.sqrt(Math.max(0,P.earned)/15000) + highestQueueTier()); }
  function canPrestige(){ return P.earned>=20000 && equityGain()>=1; }
```

In `doPrestige()` replace `if(g<1||P.level<10) return;` with `if(!canPrestige()) return;`, after `P=Object.assign(defaults(),keep);` add `seedAgents();`, and delete `updateSPui();`. In `buildShop()`'s IPO confirm text change "Resets your level, stats, credits, and all upgrades" to "Resets credits, OS, seats, hires and every agent's gear". In `renderStore()` change the two `Lv 10` strings to `$20K earned`. Replace `offlineEarnings()`'s `perSec` line with:

```js
    let perSec=0; for(let i=1;i<P.agents.length;i++){ const a=P.agents[i]; if(!a.m) agentMult(a); const q=P.queues[a.q]||P.queues[0], D=queueD(q); perSec+=a.m.chance(D)*a.m.payout(D,q)/(a.m.dur(D)+BAL.cooldown); }
    const gain=Math.floor(perSec*el*0.5);
```

and in `showWelcomeBack()` (~2991) change `set("wbEff",Math.round(MULT.offlineEff*100)+"%");` to `set("wbEff","50%");` (offline runs at a flat 50% until the Modem-equivalent returns). Replace the `ACH` rows `rig`, `agi`, `team8`, `burn`, `lv10`…`lv100` with:

```js
    {id:"lv10",   em:"⭐",name:"Getting the Hang",     desc:"Reach level 10",               chk:()=>P.level>=10,        pct:()=>P.level/10},
    {id:"lv50",   em:"👑",name:"Living Legend",       desc:"Reach level 50",               chk:()=>P.level>=50,        pct:()=>P.level/50},
    {id:"team4",  em:"👥",name:"Squad Goals",         desc:"Field 4 agents at once",       chk:()=>P.agents.length>=4, pct:()=>P.agents.length/4},
    {id:"team8",  em:"🏢",name:"Full Floor",          desc:"Field 8 agents at once",       chk:()=>P.agents.length>=8, pct:()=>P.agents.length/8},
    {id:"ilvl50", em:"🔧",name:"Serious Hardware",    desc:"Equip a Lv 50 item on anyone", chk:()=>P.agents.some(a=>ASLOT_IDS.some(s=>a.gear[s]&&a.gear[s].ilvl>=50)), pct:()=>Math.max(0,...P.agents.map(a=>Math.max(0,...ASLOT_IDS.map(s=>a.gear[s]?a.gear[s].ilvl:0))))/50},
    {id:"patched",em:"📝",name:"Custom Build",        desc:"Own an item with 3 patches",   chk:()=>P.agents.some(a=>[...ASLOT_IDS.map(s=>a.gear[s]),...a.inv].some(it=>it&&it.patches.length>=3)), binary:true},
    {id:"burn",   em:"☠️",name:"Touch Grass",          desc:"Suffer your first burnout",    chk:()=>P.burnouts>=1,  binary:true},
```

(keep `first`, `t100`, `t1000`, `strk25`, `strk100`, `crit`, `earn1m`, `win95`, `neon`, `space`, `ipo1`, `ipo5`, `stage`; delete `loot25` and `lv25`/`lv100`.) In `MULT` (~1327) shrink the object to `const MULT={workers:1,passive:0};` and check the remaining readers: `renderStore`'s `MULT.passive` (fine), `tickProgress`'s `passiveInc` (fine, 0), `buildWorkers` no longer reads it, `offlineEarnings` rewritten. Delete `FOCUS.xp` use if any remains (`agentMult` uses `FOCUS.credit`/`FOCUS.regen`).

Delete `MEMES`? No — still used by `flyMeme`. Delete `LOOT` (~950) and `P.loot`/`s_loot` (Status markup + `tickProgress`+`cacheUI`+`PERSIST`+`doPrestige keep`).

- [ ] **Step 6: Run all scenarios**

Run: `for s in boots stateShape loopEarns storeHire noOldSystems; do node tools/smoke.mjs $s || break; done`
Expected: `PASS` ×5. Then `grep -n "P\.stats\|P\.hp\b\|P\.sp\b\|P\.equip\|P\.toolbox\|P\.missions\|unlockedStats\|\bSTATS\b\|STAT_IDS\|\bSLOTS\b\|\bSLOT\b\|slotUnlocked\|MACH\|MODEL\[\|GEAR\.\|sendToCraftSlot\|completeMission" index.html` must print nothing.

- [ ] **Step 7: Commit**

```bash
git add index.html tools/smoke.mjs
git commit -m "A&Q Phase 1: remove global stats/HP/skill points, 8-slot equipment, Toolbox and Missions

Player stats, SP allocation and the HUD chips are gone (agents carry the
three stats); the Status sanity bar and the telemetry gauge/stat sheet
read agent zero. Global equip/toolbox and the Mission Board are removed
(per-agent inventory UI lands next; bounties in Phase 3). Prestige
resets everything and Equity keys off earnings + highest queue tier;
offline earnings sum the hired agents' expected rate; achievements
rewritten for the new state. Stages are story only (no heal, no XP mult)."
```

---

### Task 6: Agents app roster + per-agent Equipment / Inventory / IDE

**Files:**
- Modify: `index.html` — agents panel markup (~752–755) and terminal `#manualWrap` (~771), `buildWorkers()` (Task 3), `buildToolbox()`/`renderToolbox()` (Task 5 residue), `renderIdeCard()`/`dropOnBench()` (~1646–1690), craft actions (~2397–2460), `P.craftSlot` shape, CSS for `.sheet`.

**Interfaces:**
- Produces: `selectAgent(i)`; `selectedAgent()`; `equipFromInv(a,itemId)`, `unequipSlot(a,slotId)`, `decommissionItem(a,itemId)`, `sendToCraftSlot(a,itemId)`, `returnCraftSlot()`, `equipFromCraftSlot()`; `P.craftSlot = {owner:<agent id>, item} | null`; `renderAgentSheets()`; Equipment/Inventory apps render the selected agent; every worker tile gets a `.sheet` row (3 stats, sanity bar, queue, Select button).
- Consumes: Tasks 3–5.

- [ ] **Step 1: Smoke scenario**

```js
  // Select the hired agent, equip a better Model from its inventory via the Equipment/Inventory apps, see Quality rise.
  async perAgentGear() {
    const s0 = await boot({ fixture: s => { s.intro = false; s.credits = 100; s.reveal = { credits: true, shop: true, store: true };
      s.unlocked.inventory = true; s.unlocked.equipment = true; s.unlocked.ide = true; s.up.u_inv = 1; s.up.u_equip = 1; s.up.u_ide = 1;
      const kit = k => ({ id: 60 + ["model","memory","compute","tools"].indexOf(k), slot: k, name: "kit " + k, ilvl: 10, patches: [], maxPatches: 2 });
      s.agents.push({ id: 2, name: "bot", color: "#0ff", gear: Object.fromEntries(["model","memory","compute","tools"].map(k => [k, kit(k)])), inv: [{ id: 99, slot: "model", name: "Big Model", ilvl: 40, patches: [], maxPatches: 3 }], sanity: 100, q: 0, done: 0, failed: 0 });
      s.queues[0].seats = 2; }});
    let r = await click('.agent .sheet [data-act="select"][data-agent="1"]'); assert(r === "ok", "select button on hired agent's tile");
    await sleep(300);
    r = await click('#inventoryBody .stashCard[data-id="99"] [data-act="equip"]'); assert(r === "ok", "equip button for inventory item 99");
    await sleep(3500);
    const s1 = await readSave();
    assert(s1.selectedAgent === 1, "selectedAgent persisted");
    assert(s1.agents[1].gear.model.id === 99, "Big Model equipped on agent 1");
    assert(s1.agents[1].inv.some(it => it.id === 60), "old kit model (id 60) returned to inventory");
    const q = await ev(`document.querySelector('.agent .sheet [data-agent="1"]').closest('.sheet').querySelector('[data-stat="quality"]').textContent`);
    assert(Number(q) >= 50, "Quality shown >= 50 after equipping ilvl 40 Model, got " + q);
    r = await click('#inventoryBody .stashCard[data-id="60"] [data-act="ide"]'); assert(r === "ok", "send to IDE");
    await sleep(3500); const s2 = await readSave();
    assert(s2.craftSlot && s2.craftSlot.item.id === 60 && s2.craftSlot.owner === 2, "craft slot holds item 60 owned by agent id 2");
  },
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tools/smoke.mjs perAgentGear`
Expected: `FAIL assert: select button on hired agent's tile`

- [ ] **Step 3: Sheets on every worker tile** — in `buildWorkers()` (Task 3) change the tile `innerHTML` to add a sheet row after `.ah`:

```js
      el.innerHTML=`<div class="ah"><span class="nm" style="color:${a.color};text-shadow:0 0 8px ${a.color}"></span>
        <span class="tk"></span><span class="sTag"></span><span class="diff"></span></div>
        <div class="sheet">${AGENT_STATS.map(s=>`<span class="ss" title="${s.expl}" style="color:${s.color}">${s.em}<b data-stat="${s.id}">0</b></span>`).join("")}
          <span class="sanity" title="sanity"><i></i></span><span class="qn"></span><button class="buy sel" data-act="select" data-agent="${i}">Select</button></div>
        <div class="code"></div><div class="prog"><i></i></div>`;
```

and cache `sheet:el.querySelector(".sheet")`, `stat:Object.fromEntries(ASTAT_IDS.map(id=>[id,el.querySelector(`[data-stat="${id}"]`)]))`, `san:el.querySelector(".sanity i")`, `qn:el.querySelector(".qn")`, `sel:el.querySelector(".sel")` on `w`; wire `w.sel.addEventListener("click",e=>{e.stopPropagation();selectAgent(i);});`. Add next to `buildWorkers`:

```js
  function selectedAgent(){ return P.agents[clamp(P.selectedAgent|0,0,P.agents.length-1)]; }
  function selectAgent(i){ P.selectedAgent=clamp(i,0,P.agents.length-1); renderAgentSheets(); renderShop(); save(); }
  function renderAgentSheets(){
    for(const w of WK){ const a=workerAgent(w); if(!a.m) agentMult(a);
      for(const id of ASTAT_IDS) w.stat[id].textContent=Math.round(a.m.st[id]);
      w.san.style.width=clamp(a.sanity/a.m.sanityMax*100,0,100)+"%"; w.san.parentElement.classList.toggle("low",a.sanity/a.m.sanityMax<0.28);
      w.qn.textContent=queueTier(P.queues[a.q]||P.queues[0]).name+(a.down?" · ☕ down":"");
      w.sel.classList.toggle("on",w.i===P.selectedAgent); w.sel.textContent=w.i===P.selectedAgent?"Selected":"Select"; }
  }
```

Call `renderAgentSheets()` inside `tickProgress()` where `renderStore(); renderToolbox();` run on the 0.2 s timer. CSS (add near `.agent .ah` ~258):

```css
  .agent .sheet{display:flex;align-items:center;gap:8px;padding:2px 7px;font-size:10.5px;border-bottom:1px solid rgba(22,35,61,.7)}
  .agent .sheet .ss b{margin-left:2px}
  .agent .sheet .sanity{flex:1;height:5px;background:#0b1220;border-radius:3px;overflow:hidden;min-width:30px}
  .agent .sheet .sanity i{display:block;height:100%;background:var(--green);transition:width .3s}
  .agent .sheet .sanity.low i{background:var(--red)}
  .agent .sheet .qn{color:#5b6b86}
  .agent .sheet .sel{padding:1px 7px;font-size:10px}
  .agent .sheet .sel.on{background:var(--green);color:#000}
```

- [ ] **Step 4: Per-agent Equipment + Inventory + IDE** — in `buildToolbox()` rebuild the Equipment and Inventory sections against `selectedAgent()`:

```js
  function buildToolbox(){
    const eqBody=$("#equipBody"), invBody=$("#inventoryBody"), ideBody=$("#ideBody");
    if(!eqBody||!invBody||!ideBody) return;
    eqBody.innerHTML=invBody.innerHTML=ideBody.innerHTML=""; slotEls={};
    const eh=document.createElement("div"); eh.className="shopCat"; eh.id="equipCat"; eqBody.appendChild(eh);
    for(const s of AGENT_SLOTS){
      const card=document.createElement("div"); card.className="card slotCard"; card.draggable=true; card.title="Drag me onto the IDE bench socket to craft";
      card.innerHTML=`<span class="em">${s.em}</span><div class="mid"><div class="nm">${s.lbl} <span class="lv"></span></div><div class="fx"></div></div><button class="buy">Unequip</button>`;
      eqBody.appendChild(card);
      card.addEventListener("dragstart",e=>{ if(!selectedAgent().gear[s.id]){e.preventDefault();return;} benchPayload="eq:"+s.id; e.dataTransfer.setData("text/plain",benchPayload); e.dataTransfer.effectAllowed="move"; });
      card.addEventListener("dragend",()=>{benchPayload=null;});
      card.querySelector(".buy").addEventListener("click",e=>{ e.stopPropagation(); unequipSlot(selectedAgent(),s.id); });
      slotEls[s.id]={card,lv:card.querySelector(".lv"),fx:card.querySelector(".fx"),btn:card.querySelector(".buy")};
    }
    // IDE bench: keep the existing block VERBATIM here — from `const ih=document.createElement("div"); ih.className="shopCat"; ih.textContent="🛠 Crafting Bench";`
    // through the `for(const m of MATS){ … matEls[m.id]={…}; }` loop (benchWrap, benchRing + CRAFT_ACTIONS orbs, benchCore drag handlers, ResizeObserver, materials cards).
    const sh=document.createElement("div"); sh.className="shopCat"; sh.id="invCat"; invBody.appendChild(sh);
    const stash=document.createElement("div"); stash.id="stashList"; stash.className="stashWrap"; invBody.appendChild(stash);
    toolboxBuilt=true; renderToolbox();
  }
  function renderToolbox(){
    if(!toolboxBuilt) return;
    const a=selectedAgent(); if(!a.m) agentMult(a);
    const equipCat=$("#equipCat"); if(equipCat) equipCat.textContent="🔧 "+a.name+"'s rig";
    for(const s of AGENT_SLOTS){ const el=slotEls[s.id]; if(!el) continue; const item=a.gear[s.id];
      if(item){ el.lv.textContent="Lv "+item.ilvl; el.fx.textContent=item.name+" · "+patchSummary(item); el.btn.disabled=false; }
      else { el.lv.textContent=""; el.fx.textContent="empty — "+(s.stat?ASTAT[s.stat].lbl+" falls to the floor":"no credit bonus"); el.btn.disabled=true; } }
    const invCat=$("#invCat"); if(invCat) invCat.textContent="🧰 "+a.name+"'s inventory ("+a.inv.length+"/"+INV_CAP+")";
    renderMaterials(); renderIdeCard(); renderStashList();
  }
  function renderStashList(){
    const wrap=$("#stashList"); if(!wrap) return; const a=selectedAgent();
    const items=a.inv.slice().sort((x,y)=>y.ilvl-x.ilvl);
    if(!items.length){ wrap.innerHTML=`<div class="stashEmpty">${a.name} has nothing stashed — clearing tickets drops gear at the queue's item level.</div>`; return; }
    wrap.innerHTML=items.map(it=>`<div class="card stashCard" draggable="true" data-id="${it.id}" title="Drag me onto the IDE bench socket to craft"><span class="em">${ASLOT[it.slot].em}</span>`+
      `<div class="mid"><div class="nm">${it.name} <span class="lv">Lv ${it.ilvl}</span></div><div class="fx">${ASLOT[it.slot].lbl} · ${rarityOf(it)} · ${it.patches.length}/${it.maxPatches} patches — ${patchSummary(it)}</div></div>`+
      `<div class="actions"><button class="buy" data-act="equip">Equip</button><button class="buy" data-act="ide">→ IDE</button><button class="buy danger" data-act="dec">+${salvageValue(it)}</button></div></div>`).join("");
    wrap.querySelectorAll(".stashCard").forEach(card=>{ const id=Number(card.dataset.id);
      card.addEventListener("dragstart",e=>{ benchPayload=String(id); e.dataTransfer.setData("text/plain",benchPayload); e.dataTransfer.effectAllowed="move"; });
      card.addEventListener("dragend",()=>{benchPayload=null;});
      card.querySelector('[data-act="equip"]').addEventListener("click",e=>{e.stopPropagation();equipFromInv(a,id);});
      card.querySelector('[data-act="ide"]').addEventListener("click",e=>{e.stopPropagation();sendToCraftSlot(a,id);});
      card.querySelector('[data-act="dec"]').addEventListener("click",e=>{e.stopPropagation();decommissionItem(a,id);}); });
  }
```

Item operations (replace the Task 5 deletions):

```js
  function equipItem(a,item){
    const old=a.gear[item.slot]; if(old){ a.inv.push(old); enforceInvCap(a); }
    a.gear[item.slot]=item; recompute();
    toast("🔧 "+a.name+" equipped",item.name+" (Lv "+item.ilvl+")"+(old?" — "+old.name+" to inventory":""),"#4d8cff");
    termLine("t-git","🔧",a.name+" equipped "+item.name+" → "+ASLOT[item.slot].lbl);
  }
  function equipFromInv(a,itemId){ const i=a.inv.findIndex(x=>x.id===itemId); if(i<0) return; equipItem(a,a.inv.splice(i,1)[0]); save(); renderShop(); }
  function unequipSlot(a,slotId){ const it=a.gear[slotId]; if(!it) return; a.inv.push(it); enforceInvCap(a); a.gear[slotId]=null; recompute(); save(); renderShop(); }
  function decommissionItem(a,itemId){
    const i=a.inv.findIndex(x=>x.id===itemId); if(i<0) return;
    const item=a.inv.splice(i,1)[0], refund=salvageValue(item), matGain=Math.max(1,Math.round(item.ilvl/15));
    P.credits+=refund; P.materials.commit=(P.materials.commit||0)+matGain;
    toast("♻️ Decommissioned",item.name+" → +"+money(refund)+" · +"+matGain+" Commit","#5b6b86"); termLine("t-dim","♻",a.name+" decommissioned "+item.name);
    save(); renderShop();
  }
  const agentById=id=>P.agents.find(a=>a.id===id)||agentZero();
  function sendToCraftSlot(a,itemId){
    const i=a.inv.findIndex(x=>x.id===itemId); if(i<0) return;
    if(P.craftSlot){ const o=agentById(P.craftSlot.owner); o.inv.push(P.craftSlot.item); enforceInvCap(o); }
    P.craftSlot={owner:a.id,item:a.inv.splice(i,1)[0]};
    termLine("t-git","🛠",a.name+" sent "+P.craftSlot.item.name+" to the IDE"); save(); renderShop();
  }
  function returnCraftSlot(){ if(!P.craftSlot) return; const o=agentById(P.craftSlot.owner); o.inv.push(P.craftSlot.item); enforceInvCap(o); P.craftSlot=null; save(); renderShop(); }
  function equipFromCraftSlot(){ if(!P.craftSlot) return; const o=agentById(P.craftSlot.owner), it=P.craftSlot.item; P.craftSlot=null; equipItem(o,it); save(); renderShop(); }
  function dropOnBench(payload){
    if(!payload) return;
    if(payload.startsWith("eq:")){ const a=selectedAgent(), sid=payload.slice(3), it=a.gear[sid]; if(!it) return;
      if(P.craftSlot){ const o=agentById(P.craftSlot.owner); o.inv.push(P.craftSlot.item); enforceInvCap(o); }
      a.gear[sid]=null; P.craftSlot={owner:a.id,item:it}; recompute(); save(); renderShop(); }
    else sendToCraftSlot(selectedAgent(),Number(payload));
  }
```

`renderIdeCard()`: `const it=P.craftSlot&&P.craftSlot.item;`; **inside the `if(it){…}` branch only** add a `<span class="cSub">${agentById(P.craftSlot.owner).name}'s</span>` line to the socket and restore the two buttons wired to `equipFromCraftSlot`/`returnCraftSlot` (the empty-socket branch must not touch `P.craftSlot`, which is `null` at boot). Every `craft*()` function: `const it=P.craftSlot&&P.craftSlot.item;` instead of `const it=P.craftSlot;`, and `craftRefactor`/`craftFullRewrite` keep their `d.slot===null||d.slot===it.slot` filters (they still match the new `PATCH_DEFS`). `defaults()`: `craftSlot:null` already exists.

- [ ] **Step 5: Run all scenarios**

Run: `for s in boots stateShape loopEarns storeHire noOldSystems perAgentGear; do node tools/smoke.mjs $s || break; done`
Expected: `PASS` ×6. Also take a screenshot via `Page.captureScreenshot` in a `--keep` session (or open the file in Chrome) and eyeball: every agent tile shows three stats, a sanity bar and a Select button; Equipment/Inventory titles name the selected agent.

- [ ] **Step 6: Commit**

```bash
git add index.html tools/smoke.mjs
git commit -m "A&Q Phase 1: agent sheets on every tile; Equipment/Inventory/IDE operate on the selected agent

Each worker tile shows its three stats, sanity bar, queue and a Select
button. Equipment and Inventory render the selected agent's rig and
stash; the IDE bench socket records which agent owns the item so
return/equip put it back on the right agent. Per-agent equip/unequip/
decommission/send-to-IDE replace the global Toolbox versions."
```

---

### Task 7: Validator re-spec, docs, plan bookkeeping

**Files:**
- Modify: `tools/validate-rate.mjs` (fixture builder lines 30–40), `tools/aq-sim.mjs` (add `--probe`), `guide.md`, `README.md`, `CLAUDE.md` ("Architecture inside index.html" + "Current state"), `docs/agents-and-queues.md` (Phase 1 checkboxes + Status).

**Interfaces:**
- Produces: `FIX='{"agents":N,"ilvl":X}' node tools/validate-rate.mjs 0 60` measures the real game; `FIX=… node tools/aq-sim.mjs --probe` prints the model's rate for the same state. They must agree within 20% at kps 0 (hired agents only; agent zero idle earns 0 in both).

- [ ] **Step 1: Re-specify the validator fixture** — replace lines 30–40 of `tools/validate-rate.mjs` with:

```js
const F = JSON.parse(process.env.FIX || "{}");   // {agents, ilvl}
const nAgents = F.agents ?? 3, ilvl = F.ilvl ?? 10;
const SLOTS = ["model", "memory", "compute", "tools"]; let seq = 100;
const kit = () => Object.fromEntries(SLOTS.map(k => [k, { id: ++seq, slot: k, name: "fixture " + k, ilvl, patches: [], maxPatches: 2 }]));
Object.assign(fixture, { intro: false, credits: 0, earned: 0, tasksDone: 0, tasksFailed: 0, xp: 0, xpNeed: 1e9, plot: 0, plotNeed: 1e9, up: Object.assign(fixture.up, { os: 0 }) });   // freeze level/stage so the 60 s window is stationary
fixture.agents = Array.from({ length: nAgents }, (_, i) => ({ id: i + 1, name: i ? "bot" + i : "you", color: "#0ff", gear: kit(), inv: [], sanity: 100, q: 0, done: 0, failed: 0 }));
fixture.queues = [{ tier: 0, seats: nAgents, mods: 0, configs: [] }];
```

Also change the `read` helper (line 44) to return `{credits:d.credits, earned:d.earned, xp:d.totalXp, done:d.tasksDone, failed:d.tasksFailed, secs:d.playSecs}` and edit the `console.log(JSON.stringify({…}))` line (54) to drop `levelNow`, `stageNow` and `hp`.

- [ ] **Step 2: Add `--probe` to `tools/aq-sim.mjs`** — before the final `if (args.checks) checks(); else run();` add:

```js
if (args.probe) {   // same fixture as tools/validate-rate.mjs: N agents (agent zero idle) with uniform ilvl gear on Backlog
  const F = JSON.parse(process.env.FIX || "{}"); const n = F.agents ?? 3, il = F.ilvl ?? 10;
  const S = initial(); S.queues[0].seats = n; for (let i = 1; i < n; i++) S.agents.push(newAgent(il, 0)); S.agents[0] = newAgent(il, 0); S.hires = n;
  for (const k of [0, 2]) { let cr = 0, succ = 0, tot = 0; S.agents.forEach((a, i) => { const r = agentRate(a, S.queues[0], k, i === 0); cr += r.credits; succ += r.succ; tot += r.tps * r.uptime; });
    console.log(JSON.stringify({ kps: k, creditsPerSec: +cr.toFixed(2), tasksPerSec: +tot.toFixed(2), successRate: +(succ / Math.max(1e-9, tot)).toFixed(2) })); }
} else if (args.checks) checks(); else run();
```

i.e. the file's final statement becomes exactly `if (args.probe) { … } else if (args.checks) checks(); else run();` — delete the old `if (args.checks) checks(); else run();` line. Note `CRAFT` defaults to 1 in the sim — run the probe with `--craft 0` to match unpatched fixture gear.

- [ ] **Step 3: Run both and compare**

Run: `FIX='{"agents":3,"ilvl":10}' node tools/aq-sim.mjs --probe --craft 0` and `FIX='{"agents":3,"ilvl":10}' node tools/validate-rate.mjs 0 60`, then the same with `ilvl:40`.
Expected: real `creditsPerSec` within 20% of the model's kps-0 line for both. If it isn't, the discrepancy is a Task 3 formula transcription bug — diff `agentMult`/`resolveTask` against `agentRate` in the sim, fix, re-run the smoke scenarios.

- [ ] **Step 4: Docs** — `guide.md`: replace the Stats, Hardware slots, Toolbox, Missions and Machine/Model sections with: Agents (the sheet: three stats from four slots, no levels, sanity/burnout), Queues (Backlog only for now; success = Quality vs difficulty; payout grows with difficulty), Hiring & seats, per-agent Inventory/Equipment/IDE, drops at the queue's item level, patches table (from `PATCH_DEFS`), prestige (`$20K earned`, Equity from earnings + queue tier). `README.md`: one paragraph on the new loop and that this branch is the in-progress rewrite. `CLAUDE.md`: in "Current state" describe the branch and point at `docs/agents-and-queues.md`; in "Architecture" replace the `recompute()/MULT/GEAR`, `SLOTS`, missions and stats bullets with: `P.agents[]`/`P.queues[]`, `agentMult(a)` writing `a.m`, `BAL` as the single tunables table, `tools/smoke.mjs` as the verification entry point, `tools/aq-sim.mjs` as the balance source of truth. `docs/agents-and-queues.md`: tick every Phase 1 checkbox, add a Status line "Phase 1 shipped on branch `agents-and-queues` (date)", and note under "Known model limits" that Missions/Legendaries/Toolbox roll were removed in Phase 1 rather than Phase 3 (materials come from tickets until bounties exist).

- [ ] **Step 5: Final full run**

Run: `for s in boots stateShape loopEarns storeHire noOldSystems perAgentGear; do node tools/smoke.mjs $s || break; done`
Expected: `PASS` ×6.

- [ ] **Step 6: Commit**

```bash
git add tools/validate-rate.mjs tools/aq-sim.mjs guide.md README.md CLAUDE.md docs/agents-and-queues.md
git commit -m "A&Q Phase 1: validator re-specified for agents/queues; docs updated

validate-rate.mjs builds an N-agent Backlog fixture and aq-sim.mjs
--probe evaluates the same state, so the live game can be checked
against the balance model. guide.md/README.md describe the agent sheet,
Backlog queue, hires/seats and per-agent gear; CLAUDE.md's architecture
section covers P.agents/P.queues/agentMult/BAL and the smoke harness.
Phase 1 checkboxes ticked in docs/agents-and-queues.md."
```

---

## Self-review notes (done at plan time)

- **Spec coverage:** Phase 1 bullets → Tasks 2 (tables/state, starter kit), 3 (Backlog loop from agent stats vs band, per-agent recompute, drops), 4 (hire line + seats, OS caps hires), 5 (removals, ACH rewrite), 6 (Agents app sheets, Equipment/Inventory/IDE per agent), 7 (validator + docs). Pulled forward from Phase 2 because Phase 1 is unplayable without them: hire/seat purchase. Pulled forward from Phase 3: Mission Board removal (its code depends on the deleted stat system). Deferred: rogue proper (Phase 2; Task 3 ships a per-agent burnout stub), Toolbox roll (Phase 2, repriced), Legendaries (Phase 3).
- **Type consistency:** item shape `{id, slot, name, ilvl, patches:[{id,tier,value}], maxPatches}` unchanged; `P.craftSlot` is `{owner:<agent.id>, item}` from Task 6 on (Task 5 leaves it `null`-or-item briefly but nothing reads it between the two tasks except `renderIdeCard`, which Task 5 patches); agent shape `{id, name, color, gear:{model,memory,compute,tools}, inv, sanity, q, done, failed}` + runtime `m`, `down`.
- **Known rough edge accepted for Phase 1:** `WIN_LAYOUT` column totals must still equal `WIN_ROWS` after removing `missions` — Task 5 spells out the reassignment.
