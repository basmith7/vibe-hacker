# Agents & Queues — Phase 2 (queues, seating, rogue) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make queues purchasable, give the player a Queues app to seat agents (click-picker + drag) across boards and a Bench, and turn burnout into a real rogue state (Embezzler) with Kill -9.

**Architecture:** Everything lives in `index.html`'s single IIFE, driven by tables: `QUEUE_TIERS` generates the Store's queue/seat cards, `ROGUE_MODES` holds the one rogue mode, `seatAgent(a, qi)` is the single seating mutation, and a new Queues app (`buildQueues`/`renderQueues`) follows the build-once/update-on-timer pattern the Store uses. Balance numbers are derived in `tools/aq-sim.mjs` first and mirrored into `BAL`. Verification is `tools/smoke.mjs` scenarios (headless Chrome) — there is no unit-test framework.

**Tech Stack:** Vanilla HTML/CSS/JS (no build), Node 20+ for the harnesses, headless `google-chrome` via CDP.

**Spec:** `docs/agents-and-queues.md` — section "Phase 2 design (2026-09-17)" (§1–§4) is what this plan implements; the rest of that doc is the surrounding design.

## Global Constraints

- **No save migrations.** Any save-shape change bumps `SAVE_VER` (8 → **9** in this plan); old saves hit Guru Meditation. Never write backfill code.
- **`BAL` ↔ `tools/aq-sim.mjs` `T` stay mirrored 1:1.** A number changes in both or neither.
- **`a.m` and `a.immune` are runtime-only** — stripped in `save()`, never in `PERSIST`. `a.rogue` **is** persisted.
- **Every `P.queues[a.q] || P.queues[0]` fallback is forbidden** — the Bench is `a.q = -1` and must never resolve to the Backlog.
- **Data-driven tables, not scattered conditionals** (`CLAUDE.md`). New Store cards come from `QUEUE_TIERS`; new rogue behaviour from `ROGUE_MODES`.
- **Docs are part of done:** `guide.md`, `README.md`, `CLAUDE.md`, and the spec's `## Status` + Phase 2 checkboxes are updated inside this plan (Task 9), not later.
- **Verification command** (run before calling any task done):
  `for s in boots stateShape loopEarns storeHire seatGate noOldSystems perAgentGear queuesApp buyQueue seatAgent bench rogue offline; do node tools/smoke.mjs $s || break; done`
  (scenarios that don't exist yet are added by the task that needs them — until then run the ones that do).
- **Never commit unless the step says to.** Commit messages are detailed, written for `git log` readers with zero context, and end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- Branch: `agents-and-queues`. Do not merge to `main`.

---

## File map

| File | Responsibility in this plan |
|---|---|
| `index.html` | Game. Tables (`BAL`, `QUEUE_TIERS`-generated cards, `ROGUE_MODES`), state (`defaults`/`PERSIST`/`save`), Store (`upCost`/`osLock`/`isRevealed`/`buy`/`renderStore`/`autoBuyCheapest`), workers (`tickWorker`/`assignTask`/`resolveTask`/`mashCode`), new Queues app (HTML `#queuesPanel`, CSS, `buildQueues`/`renderQueues`/`openPicker`/`seatAgent`/drag), rogue (`goRogue`/`recoverRogue`/`kill9`), offline. |
| `tools/aq-sim.mjs` | Balance model: Embezzler replaces `rogueTax`; Bench (`q=-1`); two new `--checks`. Derives `rogueSteal`, `kill9PerIlvl`, `rogueRegen`. |
| `tools/smoke.mjs` | Scenarios: update `stateShape`/`storeHire`/`seatGate`; add `queuesApp`, `buyQueue`, `seatAgent`, `bench`, `rogue`, `offline`. |
| `tools/validate-rate.mjs` | Fixture gains optional `queues` + per-agent `q` so a two-queue state can be probed. |
| `guide.md`, `README.md`, `CLAUDE.md`, `docs/agents-and-queues.md` | Player docs, agent context, spec status. |

### Shared helper contracts (defined in Task 2, used everywhere after)

```js
function seatedQueue(a)        // → P.queues[a.q] when a.q >= 0 and exists, else null (Bench)
function ownedQueue(tier)      // → the P.queues entry with that tier, or null
function kill9Cost(a)          // → Math.round(BAL.kill9PerIlvl × Σ ilvl of non-null gear)
function seatAgent(a, qi)      // Task 5 — qi = queue index or -1; returns true/false; the ONLY place that sets a.q after hire
function goRogue(a) / recoverRogue(a, how) / kill9(a)   // Task 7
function buildQueues() / renderQueues()                // Task 5 (structural rebuild / 5 Hz update)
```

State shape after this plan (persisted unless noted):

```js
P.queues = [{tier, seats, mods, configs}]        // one per owned tier, tier order
a.q      = 0..n-1 | -1 (Bench)
a.rogue  = null | {mode:"embezzler", t:<seconds rogue>, stolen:<credits>}
a.immune = <seconds left>                          // runtime-only (stripped)
a.m      = derived stats                           // runtime-only (stripped)
P.rogues (was P.burnouts), P.stolen               // lifetime counters, kept through prestige
P.up.u_queues, P.up.queue                         // unlock flag, queues bought counter
P.unlocked.queues
```

---

### Task 1: Sim — Embezzler model, Bench, derive the rogue numbers

**Files:**
- Modify: `tools/aq-sim.mjs:22-49` (T table), `:73-85` (agentRate), `:130-142` (optimiseSeating), `:182-195` (checks)

**Interfaces:**
- Produces: the three numbers `ROGUE_STEAL`, `KILL9_PER_ILVL`, `ROGUE_REGEN`, `ROGUE_IMMUNE` in `T`, mirrored into `BAL` by Task 2 as `rogueSteal`, `kill9PerIlvl`, `rogueRegen`, `rogueImmune`. Two new `--checks` blocks.

- [ ] **Step 1: Add the rogue knobs and drop `rogueTax`**

In `tools/aq-sim.mjs` replace the line
```js
  rogueTax: 0.5,            // fraction of that agent's would-be income lost per rogue cycle (incidents)
```
with
```js
  // Rogue (Phase 2, Embezzler): while rogue an agent steals ROGUE_STEAL × bank per second and regens
  // sanity at ROGUE_REGEN × normal until 50% of sanityMax. Kill -9 costs KILL9_PER_ILVL × Σ gear ilvl
  // and restarts the agent at half sanity with ROGUE_IMMUNE s of immunity. See doc §3/§4.
  ROGUE_STEAL: 0.0026, ROGUE_REGEN: 0.5, KILL9_PER_ILVL: 8, ROGUE_IMMUNE: 20,
  SANITY_BASE: 50, SANITY_PER_STAMINA: 2,   // sanityMax = SANITY_BASE + SANITY_PER_STAMINA × Stamina (mirrors BAL)
```

- [ ] **Step 2: Model overreach as a Kill -9 cycle instead of an uptime tax**

In `agentRate`, replace
```js
  const uptime = drain <= regen ? 1 : (regen / drain) * (1 - T.rogueTax) ;   // cycling rogue costs incidents too
  const succ = tps * chance * uptime;
  return { chance, dur, tps, uptime, credits: succ * payout, succ, D, drain, regen };
```
with
```js
  // Overreach (drain > regen): the agent burns from half sanity to zero, is instantly Kill -9'd back
  // to half, and repeats — full uptime, but every cycle costs kill9Cost. Income = gross − kill9/cycle.
  const sanityMax = T.SANITY_BASE + T.SANITY_PER_STAMINA * S.stamina;
  const kill9 = T.KILL9_PER_ILVL * SLOTS.reduce((s, k) => s + a.gear[k], 0);
  const cycle = drain <= regen ? Infinity : (0.5 * sanityMax) / (drain - regen);
  const uptime = 1, killCost = cycle === Infinity ? 0 : kill9 / cycle;
  const succ = tps * chance;
  return { chance, dur, tps, uptime, credits: Math.max(0, succ * payout - killCost), succ, D, drain, regen, cycle, kill9 };
```

- [ ] **Step 3: Teach the sim the Bench**

In `rate()` replace
```js
  S.agents.forEach((a, i) => { const q = S.queues[a.q]; const r = agentRate(a, q, kps, i === 0); cr += r.credits; succByQ[a.q] += r.succ; });
```
with
```js
  S.agents.forEach((a, i) => { if (a.q < 0) return; const q = S.queues[a.q]; const r = agentRate(a, q, kps, i === 0); cr += r.credits; succByQ[a.q] += r.succ; });
```
In `stepGear` replace `S.agents.forEach((a, i) => { const q = S.queues[a.q];` with `S.agents.forEach((a, i) => { if (a.q < 0) return; const q = S.queues[a.q];`.
In `optimiseSeating` replace `if(best < 0) best = S.agents[i].q; S.agents[i].q = best; used[best]++; }` with
```js
    S.agents[i].q = best; if (best >= 0) used[best]++; }   // best < 0 = no free seat anywhere → Bench
```
In `printTable` the agents line reads `T.TIERS[S.queues[a.q].tier].name` — change that expression to `(a.q < 0 ? "Bench" : T.TIERS[S.queues[a.q].tier].name)` and `agentRate(a, S.queues[a.q], KPS, i === 0)` to `agentRate(a, S.queues[Math.max(0, a.q)], KPS, i === 0)`.

- [ ] **Step 4: Add the two design-rule checks**

Append inside `checks()` after the "best tier per gear level" loop:
```js
  // Kill -9 breakeven: a full unattended rogue (0 → 50% sanity at ROGUE_REGEN × regen) must lose ≥ 25% of the
  // bank at every Stamina, so at bank = 4 × kill9Cost paying beats waiting. ROGUE_STEAL is calibrated at endgame
  // Stamina (highest ilvl cap); lower Stamina recovers slower and therefore loses more — that's intended.
  console.log("  Kill -9 breakeven (loss of bank over a full unattended rogue; need ≥ 25% everywhere):");
  for (const il of [10, 20, 30, 45, 60, 80, 110, 150, 175]) { const a = newAgent(il, 0); const S = stats(a);
    const sanityMax = T.SANITY_BASE + T.SANITY_PER_STAMINA * S.stamina, regen = T.REGEN * S.stamina * T.ROGUE_REGEN;
    const Trec = 0.5 * sanityMax / regen, loss = 1 - Math.exp(-T.ROGUE_STEAL * Trec), kill9 = T.KILL9_PER_ILVL * il * SLOTS.length;
    console.log(`    ilvl ${String(il).padStart(3)}: recover ${Math.round(Trec)}s  loss ${Math.round(loss * 100)}%  kill9 ${money(kill9)} (= ${Math.round(kill9 / Math.max(1e-9, agentRate(a, { tier: 0, seats: 1, mods: 0 }, 0, false).credits))}s of Backlog income) ${loss >= 0.25 ? "✓" : "✗ waiting beats Kill -9"}`); }
  // Overreach with instant Kill -9: the best tier per gear level (income net of kill9/cycle) must still be a ≥85% one.
  console.log("  overreach with instant Kill -9 (net of kill9 per cycle); ✓ if best tier has ≥85% success:");
  for (const il of [10, 20, 30, 45, 60, 80, 110, 150]) { const a = newAgent(il, 0); let best = null;
    T.TIERS.forEach((tier, ti) => { const r = agentRate(a, { tier: ti, seats: 1, mods: 0 }, 0, false); if (!best || r.credits > best.r.credits) best = { ti, r }; });
    console.log(`    ilvl ${String(il).padStart(3)}: best=${T.TIERS[best.ti].name} ${Math.round(best.r.chance * 100)}% cycle ${best.r.cycle === Infinity ? "∞" : Math.round(best.r.cycle) + "s"} ${best.r.chance >= 0.85 ? "✓" : "✗ overreach pays"}`); }
```

- [ ] **Step 5: Run the checks and calibrate**

Run: `node tools/aq-sim.mjs --checks`
Expected: every row of "Kill -9 breakeven" ends in `✓` (the ilvl 175 row should read ~21–25 %, the ilvl 10 row ~45 %), every row of "overreach with instant Kill -9" ends in `✓`, and the pre-existing gear-wall / best-tier blocks are unchanged. If the ilvl 175 row is below 25 %, raise `ROGUE_STEAL` until it isn't (target `ROGUE_STEAL × Trec(175) ≈ ln(4/3) ≈ 0.288`). If any overreach row fails, raise `KILL9_PER_ILVL` and re-run. Record the final numbers — Task 2 copies them into `BAL`.

Also run: `node tools/aq-sim.mjs --brief --kps 2 --craft 0.5`
Expected: STARSHIP still lands in roughly 4.5–6 h (the doc's reference pacing was 5h06; the Kill -9 cycle model only changes overreach rows, which the bot never chooses). If it moved by more than ±20 %, stop and report — do not tune other knobs.

- [ ] **Step 6: Commit**

```bash
git add tools/aq-sim.mjs
git commit -m "A&Q Phase 2: model the Embezzler rogue and the Bench in aq-sim

Replaces the rogueTax uptime penalty with the Phase 2 design: an overreaching
agent burns sanity, is Kill -9'd back to half and repeats, so its income is
gross minus kill9Cost per cycle. Adds ROGUE_STEAL / ROGUE_REGEN /
KILL9_PER_ILVL / ROGUE_IMMUNE, the Bench (q = -1, zero rate), and two
--checks: Kill -9 breakeven (a full unattended rogue loses >= 25% of bank at
every Stamina, calibrated at endgame) and overreach-with-instant-Kill-9.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: State — SAVE_VER 9, Bench semantics, rogue fields, BAL keys

**Files:**
- Modify: `index.html:972-980` (BAL), `:1064-1069` (helpers), `:1152` (SAVE_VER), `:1190-1225` (defaults/PERSIST/unlockAll), `:1252-1259` (save), `:1662-1666` (doPrestige keep), `:1689` (ACH burn), `:2257-2262` (burnout), `:2297-2301` (renderAgentSheets/workerQueue), `:2302-2310` (assignTask), `:2338-2361` (resolveTask tail, tickWorker, mashCode), `:2679` (offlineEarnings), `:2708` (boot assignTask loop)
- Test: `tools/smoke.mjs` — `stateShape` (update), `bench` (new)

**Interfaces:**
- Produces: `seatedQueue(a)`, `ownedQueue(tier)`, `kill9Cost(a)`, `BAL.{queueCost,rogueSteal,kill9PerIlvl,rogueRegen,rogueImmune}`, `P.rogues`, `P.stolen`, `P.up.u_queues`, `P.up.queue`, `P.unlocked.queues`, `a.rogue`, `a.immune`. `goRogue(a)` exists here as the *minimal* replacement for `burnout(a)` (Task 7 fleshes it out).
- Consumes: Task 1's numbers.

- [ ] **Step 1: Update `stateShape` and add `bench` to the smoke harness**

In `tools/smoke.mjs` replace the `stateShape` scenario body with:
```js
  async stateShape() {
    const s = await boot();
    assert(s.ver === 9, "SAVE_VER must be 9, got " + s.ver);
    assert(Array.isArray(s.agents) && s.agents.length === 1, "fresh save has exactly one agent (you)");
    const a = s.agents[0];
    for (const k of ["model", "memory", "compute", "tools"]) assert(a.gear[k] && a.gear[k].ilvl === 10, "agent zero starter " + k + " ilvl 10");
    assert(Array.isArray(a.inv), "agent has inv"); assert(typeof a.sanity === "number", "agent has sanity"); assert(a.q === 0, "agent seated in queue 0");
    assert(a.rogue === null, "agent zero starts not rogue (a.rogue persisted as null)");
    assert(Array.isArray(s.queues) && s.queues.length === 1 && s.queues[0].tier === 0 && s.queues[0].seats === 1, "one Backlog queue with one seat");
    assert(s.selectedAgent === 0, "selectedAgent defaults to 0");
    assert(!("m" in a) && !("down" in a) && !("immune" in a), "runtime fields must not be persisted");
    assert(s.rogues === 0 && s.stolen === 0 && !("burnouts" in s), "P.rogues/P.stolen replace P.burnouts");
    assert(s.up.u_queues === 0 && s.up.queue === 0 && s.unlocked.queues === false, "queues unlock/counter fields present");
  },
```
Add a new scenario after `perAgentGear`:
```js
  // A benched agent (q = -1) works no tickets, regenerates sanity, and is never treated as "on Backlog".
  async bench() {
    const kit = k => ({ id: 60 + ["model","memory","compute","tools"].indexOf(k), slot: k, name: "kit " + k, ilvl: 10, patches: [], maxPatches: 2 });
    const s0 = await boot({ fixture: s => { s.intro = false; s.credits = 0; s.earned = 0; s.reveal = { credits: true, shop: true, store: true };
      s.agents.push({ id: 2, name: "bot", color: "#0ff", gear: Object.fromEntries(["model","memory","compute","tools"].map(k => [k, kit(k)])), inv: [], sanity: 20, q: -1, done: 0, failed: 0, rogue: null });
      s.queues[0].seats = 1; }});
    assert(s0.agents[1].q === -1, "fixture agent is benched");
    await sleep(20000);
    const s1 = await readSave();
    assert(s1.agents[1].done + s1.agents[1].failed === 0, "benched agent must not work tickets");
    assert(s1.earned === 0, "benched agent must not earn");
    assert(s1.agents[1].sanity > 20, "benched agent regenerates sanity");
    const qn = await ev(`document.querySelector('.agent .sheet [data-agent="1"]').closest('.sheet').querySelector('.qn').textContent`);
    assert(/bench/i.test(qn), "tile shows Bench, not Backlog: " + qn);
  },
```

- [ ] **Step 2: Run both to verify they fail**

Run: `node tools/smoke.mjs stateShape; node tools/smoke.mjs bench`
Expected: `FAIL assert: SAVE_VER must be 9, got 8` and `FAIL` on bench (the agent works tickets via the Backlog fallback, or the `.qn` reads "Backlog").

- [ ] **Step 3: BAL keys, helpers, SAVE_VER**

In `index.html` `BAL`, after the `hireBase…` line add:
```js
    queueCost:[0,2000,20000,200000,2000000,15000000],   // install cost per QUEUE_TIERS index (Backlog is free/day one)
    rogueSteal:0.0026, rogueRegen:0.5, kill9PerIlvl:8, rogueImmune:20,   // Embezzler: bank fraction stolen /s; regen mult while rogue; Kill -9 $/Σilvl; immunity s
```
(use the numbers Task 1 settled on if they differ). Change `SAVE_VER=8` to `SAVE_VER=9`.

After `const agentZero=()=>P.agents[0];` add:
```js
  // Phase 2 — seating helpers. a.q === -1 is the Bench: no queue, no tickets, full-rate regen. Nothing may
  // fall back to P.queues[0] for a benched agent (that would silently make the Bench the Backlog).
  const seatedQueue=a=>(a.q>=0&&P.queues[a.q])||null;
  const ownedQueue=tier=>P.queues.find(q=>q.tier===tier)||null;
  function kill9Cost(a){ let s=0; for(const k of ASLOT_IDS){ const it=a.gear[k]; if(it) s+=it.ilvl; } return Math.round(BAL.kill9PerIlvl*s); }
```
In `newAgent` change `q:q||0` to `q:(q==null?0:q)` and add `rogue:null` to the object: `{id:++P.agentSeq, name:who.name, color:who.color, gear:{}, inv:[], sanity:100, q:(q==null?0:q), done:0, failed:0, rogue:null}`.

- [ ] **Step 4: defaults / PERSIST / save / prestige / unlockAll**

In `defaults()`: change `playSecs:0,burnouts:0,crits:0,` to `playSecs:0,rogues:0,stolen:0,crits:0,`; in `up:{…}` add `u_queues:0,queue:0,` after `u_ide:0,`; in `unlocked:{…}` add `queues:false` at the end.
In `PERSIST` replace `"playSecs","burnouts","crits",` with `"playSecs","rogues","stolen","crits",`.
In `save()` change the comment + line to:
```js
    // a.m (derived stats) and a.immune (Kill -9 grace) are runtime-only — recompute()/the tick rebuild them.
    ...
    o.agents=P.agents.map(a=>{ const {m,immune,...rest}=a; return rest; });
```
In `doPrestige` `keep`: replace `burnouts:P.burnouts,` with `rogues:P.rogues, stolen:P.stolen,`.
In `unlockAll()` add `queues:true`.
In `ACH` change the `burn` row to `{id:"burn", em:"☠️",name:"Touch Grass", desc:"Watch an agent go rogue", chk:()=>P.rogues>=1, binary:true},`.
Grep for any other `P.burnouts` / `.down` use (`grep -n "burnouts\|\.down\b" index.html`) and convert each: `P.burnouts` → `P.rogues`; `a.down` → `a.rogue` (truthiness is the same contract).

- [ ] **Step 5: Bench + rogue in the worker loop**

Replace `burnout(a)` with the minimal `goRogue(a)` (Task 7 expands it):
```js
  function goRogue(a){
    P.rogues++; a.rogue={mode:"embezzler",t:0,stolen:0}; a.sanity=0; P.streak=0;
    const w=WK[P.agents.indexOf(a)]; if(w) w.task=null;
    celebrate("☠ "+a.name.toUpperCase()+" WENT ROGUE","#ff2b5e"); if(a===agentZero()) flashHp();
    toast("☠ Rogue",a.name+" is off the board until sanity is back to 50%","#ff2b5e","progress");
    termLine("t-bad","☠",a.name+" went ROGUE — sanity hit zero"); save();
  }
  function recoverRogue(a,how){ a.rogue=null; termLine("t-info","☕",a.name+" "+how); }
```
Replace `const workerQueue=w=>P.queues[workerAgent(w).q]||P.queues[0];` with `const workerQueue=w=>seatedQueue(workerAgent(w));`.
In `renderAgentSheets` replace `w.qn.textContent=queueTier(P.queues[a.q]||P.queues[0]).name+(a.down?" · ☕ down":"");` with
```js
      const sq=seatedQueue(a); w.qn.textContent=(sq?queueTier(sq).name:"Bench")+(a.rogue?" · ☠ ROGUE":"");
```
At the top of `assignTask` after `const a=workerAgent(w), q=workerQueue(w)` add a guard — restructure the first lines to:
```js
    const a=workerAgent(w), q=workerQueue(w);
    if(!q){ w.task=null; w.tk.textContent="on the bench"; w.sTag.textContent=""; w.dEl.textContent=""; w.prog.style.width="0%"; return; }
    const D=queueD(q);
```
Replace the whole `tickWorker` with:
```js
  function tickWorker(w,dt){
    const a=workerAgent(w); if(!a.m) agentMult(a);
    if(a.immune>0) a.immune=Math.max(0,a.immune-dt);
    // Regen: rogue agents recover at BAL.rogueRegen × normal (applied here, not in agentMult, so the transitions
    // need no recompute()). While immune (just Kill -9'd) sanity can't touch zero.
    a.sanity=clamp(a.sanity+dt*a.m.regen*(a.rogue?BAL.rogueRegen:1),a.immune>0?1:0,a.m.sanityMax);
    if(a.rogue){ a.rogue.t+=dt; ROGUE_MODES[a.rogue.mode].tick(a,dt,w);
      if(a.sanity>=a.m.sanityMax*0.5) recoverRogue(a,"is back — recovered on its own"); else return; }
    if(a.q<0){ if(w.task||w.tk.textContent!=="on the bench") assignTask(w); return; }   // Bench: no tickets, tile says so
    if(!w.manual){ w.acc+=dt*(12+surge*6); let n=w.acc|0; w.acc-=n; if(n>0) revealChars(w,n); }
    if(w.flashT>0){ w.flashT-=dt; if(w.flashT<=0) w.el.classList.remove("win","fail","crit"); }
    if(!w.task){ w.cooldown-=dt; if(w.cooldown<=0) assignTask(w); return; }
    if(!w.manual) w.elapsed+=dt*(1+BAL.surgeSpeed*(surge-1));   // typing is a small team-wide boost, not a 4× lever
    w.prog.style.width=clamp(w.elapsed/w.task.dur*100,0,100)+"%";
    if(w.elapsed>=w.task.dur) resolveTask(w);
  }
```
Add the table right above `goRogue` (Task 7 fills in the real Embezzler; this stub keeps the tick callable):
```js
  // Rogue modes (Phase 2 ships one; Phase 4 adds rows, escalation and Countermeasures — never branches here).
  const ROGUE_MODES={
    embezzler:{lbl:"Embezzler", em:"💸", desc:"siphons a slice of your bank every second", tick(a,dt,w){}},
  };
```
In `resolveTask`'s failure branch change `a.sanity=clamp(a.sanity-dmg,0,a.m.sanityMax);` to `a.sanity=clamp(a.sanity-dmg,a.immune>0?1:0,a.m.sanityMax);` and `if(a.sanity<=0) burnout(a);` to `if(a.sanity<=0) goRogue(a);`. In the success branch change `a.sanity=clamp(a.sanity-drainWork,0,a.m.sanityMax);` to `a.sanity=clamp(a.sanity-drainWork,a.immune>0?1:0,a.m.sanityMax);`.
In `mashCode` change `if(w.task && !workerAgent(w).down)` to `const a=workerAgent(w); if(w.task && !a.rogue && a.q>=0)`.
In `offlineEarnings` change the loop body to `const a=P.agents[i]; if(a.rogue||a.q<0) continue; if(!a.m) agentMult(a); const q=P.queues[a.q], D=queueD(q); …` (drop the `||P.queues[0]`).
At boot change `WK.forEach(w=>{ assignTask(w); w.elapsed=w.manual?0:rand(0,w.task.dur*0.6); });` to `WK.forEach(w=>{ assignTask(w); if(w.task) w.elapsed=w.manual?0:rand(0,w.task.dur*0.6); });`.
Update the Telemetry sanity gauge `title` (line ~768): replace "At 0% the agent burns out and takes a coffee break until sanity is back to 50%." with "At 0% the agent goes rogue — off the board and stealing from you — until sanity is back to 50% or you Kill -9 it."; and in `AGENT_STATS` change "zero means burnout" to "zero means it goes rogue".

- [ ] **Step 6: Run the scenarios**

Run: `for s in boots stateShape loopEarns storeHire seatGate noOldSystems perAgentGear bench; do node tools/smoke.mjs $s || break; done`
Expected: all `PASS`. (`grep -n "burnout\|\.down\b\|P.queues\[a.q\]||" index.html` must print nothing.)

- [ ] **Step 7: Commit**

```bash
git add index.html tools/smoke.mjs
git commit -m "A&Q Phase 2: Bench, rogue state and SAVE_VER 9

a.q = -1 is now the Bench: a seatedQueue(a) helper returns null there and
every former P.queues[a.q]||P.queues[0] fallback (workerQueue, agent tiles,
offline earnings, mashCode, boot) branches on it, so a benched agent works
nothing and regens at full rate. burnout(a)/a.down become goRogue(a)/a.rogue
({mode,t,stolen}, persisted); a.immune is the runtime-only Kill -9 grace and
rogue regen is applied at the tick site. P.burnouts -> P.rogues, new P.stolen,
both kept through IPO. BAL gains queueCost and the rogue knobs derived in
aq-sim. SAVE_VER 8 -> 9 (no migration). Smoke: stateShape updated, bench added.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Store — Queues app unlock, generated queue/seat cards, hire → Bench, Auto-Buyer

**Files:**
- Modify: `index.html:1070-1085` (UPG), `:1300-1330` (upCost/osLock/isRevealed), `:1331-1365` (buy), `:1366-1371` (autoBuyCheapest), `:1636-1642` (renderStore)
- Test: `tools/smoke.mjs` — `storeHire` + `seatGate` (update), `queuesApp` (new, Store half), `buyQueue` (new)

**Interfaces:**
- Consumes: `ownedQueue`, `seatedQueue`, `BAL.queueCost` (Task 2).
- Produces: `UPG` entries `u_queues`, `q_<tierId>`, `seat_<tierId>` (`data-upg` attributes of the same names); `P.unlocked.queues`; `buildQueues()` is *called* from `buy` — Task 5 defines it, so until then define a stub `function buildQueues(){}` next to `buildShop` and let Task 5 replace it.

- [ ] **Step 1: Update `storeHire`/`seatGate`, add `queuesApp` and `buyQueue` scenarios**

Replace `storeHire` and `seatGate` in `tools/smoke.mjs` with:
```js
  // Hire from the Store: with no free seat the hire lands on the Bench (not blocked); with a seat it sits on Backlog.
  async storeHire() {
    const s0 = await boot({ fixture: s => { s.intro = false; s.credits = 10000; s.reveal = { credits: true, shop: true, store: true }; s.maxCredits = 10000; s.up.os = 1; s.up.u_queues = 1; s.unlocked.queues = true; }});
    assert(s0.agents.length === 1, "start with one agent");
    let r = await click('[data-upg="hire"] .buy'); assert(r === "ok", "hire card present");
    await sleep(3500); let s1 = await readSave();
    assert(s1.agents.length === 2 && s1.agents[1].q === -1, "with no free seat the hire lands on the Bench");
    r = await click('[data-upg="seat_backlog"] .buy'); assert(r === "ok", "Backlog seat card present"); await sleep(3500); s1 = await readSave();
    assert(s1.queues[0].seats === 2, "seat bought");
    assert(s1.agents[1].gear.model.ilvl === 10, "hire has starter kit");
    assert(s1.credits < 10000 - 150, "credits were spent");
  },
  // On MS-DOS (hire cap 1) the Backlog Seat card must be OS-locked: a seat you cannot fill is a credit trap.
  async seatGate() {
    const s0 = await boot({ fixture: s => { s.intro = false; s.credits = 5000; s.maxCredits = 5000; s.reveal = { credits: true, shop: true, store: true }; s.up.u_queues = 1; s.unlocked.queues = true; /* up.os stays 0 = MS-DOS */ }});
    assert(s0.queues[0].seats === 1, "fixture starts with one seat");
    await click('[data-upg="seat_backlog"] .buy');
    await sleep(3500);
    const s1 = await readSave();
    assert(s1.queues[0].seats === 1, "seat must not be buyable on MS-DOS (hire cap 1), got seats=" + s1.queues[0].seats);
    const txt = await ev(`document.querySelector('[data-upg="seat_backlog"] .buy').textContent`);
    assert(txt.includes("\u{1F512}"), "seat buy button should show a lock, got: " + txt);
  },
  // The Queues app is a Store unlock; Hire/Seat cards hide until it is owned; the app renders Backlog + Bench boards.
  async queuesApp() {
    await boot({ fixture: s => { s.intro = false; s.credits = 5000; s.maxCredits = 5000; s.reveal = { credits: true, shop: true, store: true }; }});
    const vis = sel => ev(`(()=>{const el=document.querySelector(${JSON.stringify(sel)}); return !!el && getComputedStyle(el).display!=='none';})()`);
    assert(!(await vis('[data-upg="hire"]')), "Hire card hidden before the Queues app");
    assert(!(await vis('[data-upg="seat_backlog"]')), "Seat card hidden before the Queues app");
    assert(!(await vis('#queuesPanel')), "Queues panel hidden before purchase");
    const r = await click('[data-upg="u_queues"] .buy'); assert(r === "ok", "u_queues card present");
    await sleep(3500);
    const s1 = await readSave();
    assert(s1.unlocked.queues === true && s1.up.u_queues === 1, "Queues app unlocked");
    assert(await vis('[data-upg="hire"]') && await vis('[data-upg="seat_backlog"]'), "Hire/Seat cards revealed after the Queues app");
    assert(await vis('#queuesPanel'), "Queues panel visible after purchase");
    const boards = await ev(`[...document.querySelectorAll('#queuesBody .qboard')].map(b=>b.dataset.q)`);
    assert(boards.join(",") === "0,-1", "Backlog board + Bench board, got " + boards);
    assert(await ev(`!!document.querySelector('#queuesBody .qboard[data-q="0"] .qchip[data-agent="0"]')`), "agent zero chip sits on Backlog");
  },
  // Queues are bought in tier order from the Store, OS-locked; buying one adds its board and its seat card.
  async buyQueue() {
    const s0 = await boot({ fixture: s => { s.intro = false; s.credits = 10000; s.maxCredits = 10000; s.reveal = { credits: true, shop: true, store: true }; s.up.os = 1; s.up.u_queues = 1; s.unlocked.queues = true; }});
    assert(s0.queues.length === 1, "start with Backlog only");
    const vis = sel => ev(`(()=>{const el=document.querySelector(${JSON.stringify(sel)}); return !!el && getComputedStyle(el).display!=='none';})()`);
    assert(await vis('[data-upg="q_kanban"]') && !(await vis('[data-upg="q_jira"]')), "only the next tier's card is revealed");
    assert(!(await vis('[data-upg="seat_kanban"]')), "Kanban seat card hidden until Kanban is owned");
    let r = await click('[data-upg="q_kanban"] .buy'); assert(r === "ok", "Kanban card present");
    await sleep(3500); const s1 = await readSave();
    assert(s1.queues.length === 2 && s1.queues[1].tier === 1 && s1.queues[1].seats === 1, "Kanban installed with one seat");
    assert(s1.up.queue === 1 && s1.credits <= 10000 - 2000, "queue counter and cost");
    assert(await vis('[data-upg="seat_kanban"]'), "Kanban seat card revealed");
    const txt = await ev(`document.querySelector('[data-upg="q_jira"] .buy').textContent`);
    assert(txt.includes("\u{1F512}"), "Jira needs Win95 → locked button, got " + txt);
    const boards = await ev(`[...document.querySelectorAll('#queuesBody .qboard')].map(b=>b.dataset.q)`);
    assert(boards.join(",") === "0,1,-1", "boards are Backlog, Kanban, Bench: " + boards);
  },
```
(`queuesApp`/`buyQueue` assert on `#queuesBody .qboard` — those parts pass only after Task 5; run them now to see the Store halves fail for the right reason, and run them again after Task 5.)

- [ ] **Step 2: Run to verify they fail**

Run: `node tools/smoke.mjs storeHire; node tools/smoke.mjs queuesApp; node tools/smoke.mjs buyQueue`
Expected: `FAIL` — `storeHire` on "with no free seat the hire lands on the Bench", `queuesApp` on "Hire card hidden before the Queues app", `buyQueue` on `q_kanban` missing.

- [ ] **Step 3: Generate the cards**

In `UPG`, delete the `seat` row (`{id:"seat", kind:"seat", …"Backlog Seat"…}`) and add after the `u_globe` row:
```js
    {id:"u_queues",kind:"unlock",emoji:"📋",name:"Open the Queues app", cost:2000, unlocks:"queues", meme:"QUEUES", cat:"Getting Started", fx:()=>"reveal the Queues app — every board, its seats, and who sits where"},
```
Right after the `UPG` array closes, append the generated cards (Team category, so they sort with Hire):
```js
  // Phase 2 — queue + seat cards are generated from QUEUE_TIERS once at load (buildShop is build-once);
  // isRevealed() decides which are visible. Backlog has no install card (owned day one), every tier has a seat card.
  for(const [i,t] of QUEUE_TIERS.entries()){
    if(i>0) UPG.push({id:"q_"+t.id, kind:"queue", tier:i, emoji:t.em, name:"Install "+t.name, cat:"Team",
      fx:()=>ownedQueue(i)?("a tier-"+i+" board · difficulty "+t.D+" · drops up to ilvl "+Math.round(queueBandTop(ownedQueue(i)))):("a harder board (difficulty "+t.D+") with richer tickets and higher item levels")});
    UPG.push({id:"seat_"+t.id, kind:"seat", tier:i, emoji:"🪑", name:t.name+" Seat", cat:"Team",
      fx:()=>{ const q=ownedQueue(i); return q?("seats on "+t.name+": "+q.seats+" → "+(q.seats+1)):""; }});
  }
  UPG.sort((a,b)=>(a.cat==="Team")===(b.cat==="Team")?0:(a.cat==="Team"?-1:1));   // stable: keeps Team first so the Store's category order is unchanged
```
Change the `hire` row's `fx` to `fx:()=>P.agents.length+" on the team · a new hire ships with a Junior starter kit"+(freeSeatQueue()?"":" · no free seat — it'll wait on the Bench")`.

- [ ] **Step 4: Cost, lock, reveal, buy, render, auto-buy**

`upCost`: replace the `seat` line with
```js
    if(u.kind==="seat"){ const q=ownedQueue(u.tier); return q?seatCost(q):null; }
    if(u.kind==="queue"){ return ownedQueue(u.tier)?null:BAL.queueCost[u.tier]; }
```
`osLock`: replace the `seat` line with
```js
    else if(u.kind==="seat"){ const q=ownedQueue(u.tier); const n=q?HIRE_CAP.findIndex(c=>c>=q.seats+1):-1; need=n<0?null:n; }
    else if(u.kind==="queue") need=QUEUE_TIERS[u.tier].os;
```
`isRevealed`: replace `if(u.cat==="Team") return true;` with
```js
    if(u.cat==="Team"){   // the whole Team section is the Queues app's to reveal (doc §1)
      if(!P.unlocked.queues) return false;
      if(u.kind==="seat") return !!ownedQueue(u.tier);
      if(u.kind==="queue") return !!ownedQueue(u.tier-1);   // tiers install in order; hidden (never OWNED) until the previous one exists
      return true;
    }
```
`buy`: replace the `hire` branch with
```js
    } else if(u.kind==="hire"){
      const q=freeSeatQueue(), qi=q?P.queues.indexOf(q):-1;
      const who=pick(AGENTS.filter(x=>!P.agents.some(a=>a.name===x.name)))||pick(AGENTS);
      const a=newAgent(who,qi); P.agents.push(a); P.up.hire++;
      recompute(); buildWorkers(); applyLayout(); assignTask(WK[WK.length-1]); buildQueues();
      toast("👥 Hired — "+a.name, q?("seated on "+queueTier(q).name+" with a starter kit"):"no free seat — waiting on the Bench (seat them in the Queues app)", "#39ff14");
      termLine("t-git","👥","hired "+a.name+(q?"":" → Bench"));
```
and the `seat` branch with
```js
    } else if(u.kind==="seat"){
      const q=ownedQueue(u.tier); q.seats++; P.up.seat++; buildQueues();
      toast("🪑 New seat",queueTier(q).name+" now seats "+q.seats,"#00e5ff"); termLine("t-git","🪑","added a "+queueTier(q).name+" seat");
    } else if(u.kind==="queue"){
      P.queues.push({tier:u.tier,seats:1,mods:0,configs:[]}); P.up.queue++; buildQueues();
      const t=QUEUE_TIERS[u.tier];
      celebrate(t.em+" "+t.name.toUpperCase()+" INSTALLED","#00e5ff"); flyMeme(t.name.toUpperCase());
      toast(t.em+" "+t.name+" installed","difficulty "+t.D+" · one seat · seat agents in the Queues app","#00e5ff");
      termLine("t-git",t.em,"installed the "+t.name+" board");
```
`renderStore`: replace `else if(u.kind==="seat"){ s.lv.textContent=P.queues[0].seats+" seats"; }` with
```js
      else if(u.kind==="seat"){ const q=ownedQueue(u.tier); s.lv.textContent=(q?q.seats:0)+" seats"; }
      else if(u.kind==="queue"){ s.lv.textContent=ownedQueue(u.tier)?"✓":""; }
```
`autoBuyCheapest`: replace the function with
```js
  function autoBuyCheapest(){ let best=null,bc=Infinity;
    // Candidates (doc §1): hire only when a seat is free; a seat only when none is; next queue; OS. All must be revealed.
    const anyFree=!!freeSeatQueue();
    for(const u of UPG){ if(u.cat==="Automation"||!isRevealed(u)) continue;
      if(u.id==="os" && P.settings && P.settings.themeLock) continue;   // "Lock OS look" keeps the auto-buyer from switching your theme
      if(u.kind==="hire" && !anyFree) continue;
      if(u.kind==="seat" && anyFree) continue;
      const c=upCost(u); if(c!=null&&c<=P.credits&&c<bc&&osLock(u)==null){bc=c;best=u;} }
    if(best) buy(best);
  }
```
Add the temporary stub right before `function buildShop(){`: `function buildQueues(){}   // replaced in Task 5`.
Also, the intro `endIntro` hint says "hire agents to work the queue" — leave it.

- [ ] **Step 5: Run the scenarios**

Run: `for s in boots stateShape loopEarns storeHire seatGate noOldSystems perAgentGear bench; do node tools/smoke.mjs $s || break; done; node tools/smoke.mjs queuesApp; node tools/smoke.mjs buyQueue`
Expected: the first eight `PASS`; `queuesApp` fails only at "Queues panel visible after purchase" (or the `.qboard` assert) and `buyQueue` only at the `.qboard` assert — both are Task 5's.

- [ ] **Step 6: Commit**

```bash
git add index.html tools/smoke.mjs
git commit -m "A&Q Phase 2: Store sells queues and per-queue seats; Queues app unlock

Queue and seat cards are generated from QUEUE_TIERS at load (q_<tier>,
seat_<tier>), so buildShop stays build-once and isRevealed owns visibility:
the whole Team section waits for the new \$2K 'Open the Queues app' unlock,
a seat card appears once its queue is owned, an install card once the
previous tier is. Queues cost BAL.queueCost and are OS-locked via
QUEUE_TIERS[].os; a seat is capped at HIRE_CAP[os] per queue as before.
Hire no longer needs a free seat - it lands on the Bench. Auto-Buyer's
candidate set is now explicit (hire only with a free seat, a seat only
without one, next queue, OS) and gated on isRevealed.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Queues app shell — panel, APPS entry, layout slot, CSS

**Files:**
- Modify: `index.html` HTML (after the `#agentsPanel` section, ~line 760), CSS (after the `.agent .sheet` rules, ~line 270), `APPS` (~1796), `WIN_LAYOUT` (~1165)
- Test: `queuesApp` (panel-visible assert)

**Interfaces:**
- Produces: `#queuesPanel` / `#queuesBody` / `#queuesTag` DOM; app id `queues`; CSS classes `.qboard`, `.qboard.bench`, `.qboard.over`, `.qhead`, `.qmeta`, `.qseats`, `.qseat.empty`, `.qchip`, `.qchip.rogue`, `.qchip.dragging`, `.qchip .k9`, `.qpicker`, `.qopt`, `.qopt.cur`, `.qopt.full`.

- [ ] **Step 1: HTML**

After the `</section>` closing `#agentsPanel` add:
```html
    <section class="panel" id="queuesPanel" data-app="queues">
      <div class="head"><span class="dot"></span> QUEUES <span class="spacer"></span><span class="tag" id="queuesTag">1 board</span></div>
      <div id="queuesBody"></div>
    </section>
```

- [ ] **Step 2: APPS + WIN_LAYOUT**

In `APPS` insert after the `ide` row:
```js
    {id:"queues",      panelId:"queuesPanel",   order:8, emoji:"📋", title:"Queues",      unlocked:()=>!!P.unlocked.queues},
```
In `WIN_LAYOUT` replace the column-1 rows so the column still totals `WIN_ROWS` (7):
```js
    agents:      {c:1, r:0, h:3, z:2},
    deploy_mesh: {c:1, r:3, h:1, z:4},
    queues:      {c:1, r:4, h:2, z:12},
    achievements:{c:1, r:6, h:1, z:11},
```

- [ ] **Step 3: CSS**

After the `.agent .sheet .sanity{…}` rule add:
```css
  /* ---- Queues app (A&Q Phase 2): one board per owned queue + the Bench; agents are chips ---- */
  #queuesPanel{display:flex;flex-direction:column}
  #queuesBody{flex:1;min-height:0;overflow:auto;padding:6px;display:flex;flex-direction:column;gap:6px}
  .qboard{border:1px solid var(--edge);border-radius:6px;padding:5px 7px;background:rgba(11,18,32,.6)}
  .qboard.bench{border-style:dashed;opacity:.85}
  .qboard.over{border-color:var(--green);box-shadow:0 0 12px rgba(57,255,20,.35) inset}
  .qhead{display:flex;align-items:center;gap:6px;font-size:10.5px;margin-bottom:4px}
  .qhead .qname{color:var(--txt)} .qhead .qmeta{color:var(--dim);margin-left:auto;font-size:9.5px;white-space:nowrap}
  .qseats{display:flex;flex-wrap:wrap;gap:5px}
  .qseat.empty{border:1px dashed var(--edge);border-radius:14px;padding:3px 9px;font-size:9.5px;color:var(--dim)}
  .qchip{position:relative;display:flex;align-items:center;gap:5px;border:1px solid var(--edge);border-radius:14px;padding:3px 8px;font-size:10px;cursor:grab;user-select:none;background:#0b1220;touch-action:none}
  .qchip .dot{width:7px;height:7px;border-radius:50%;background:var(--ac);box-shadow:0 0 6px var(--ac)}
  .qchip .nm{font-weight:700;color:var(--ac)} .qchip .pct{color:var(--amber)}
  .qchip .san{width:34px;height:4px;background:#0b1220;border:1px solid var(--edge);border-radius:2px;overflow:hidden} .qchip .san i{display:block;height:100%;background:var(--green)}
  .qchip.rogue{border-color:var(--red);box-shadow:0 0 10px rgba(255,43,94,.4)} .qchip.rogue .pct{color:var(--red)}
  .qchip .k9{display:none;font-size:9px;padding:1px 6px;margin-left:2px} .qchip.rogue .k9{display:inline-block}
  .qchip.dragging{pointer-events:none;opacity:.8;z-index:60;cursor:grabbing}
  .qpicker{position:absolute;top:100%;left:0;margin-top:4px;min-width:210px;z-index:70;display:flex;flex-direction:column;gap:2px;padding:5px;background:#0b1220;border:1px solid var(--edge);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.5);cursor:default}
  .qopt{display:flex;justify-content:space-between;gap:10px;padding:4px 7px;border-radius:4px;font-size:10px;cursor:pointer;white-space:nowrap}
  .qopt:hover{background:rgba(0,229,255,.12)} .qopt.cur{color:var(--green)} .qopt.full{opacity:.45;cursor:not-allowed}
  .qopt span{color:var(--dim)}
```

- [ ] **Step 4: Verify the panel exists and layouts still total**

Run: `node tools/smoke.mjs queuesApp`
Expected: now fails at the `.qboard` assert (panel visible, body empty). Run `node tools/smoke.mjs noOldSystems` → `PASS` (11 panels tile).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "A&Q Phase 2: Queues app shell (panel, APPS entry, layout slot, CSS)

Adds #queuesPanel as the 11th app (order 8, unlocked by P.unlocked.queues),
carves it a 2-half-row slot from column 1 of WIN_LAYOUT (deploy_mesh and
achievements drop to 1 each, column still totals WIN_ROWS), and the board /
chip / picker styles the seating UI uses. No behaviour yet.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Queues app — boards, chips, picker, `seatAgent`

**Files:**
- Modify: `index.html` — replace the `buildQueues(){}` stub (Task 3) with the real app, next to `buildShop`; `tickProgress` 0.2 s refresh (~2401); boot (~2696); `doPrestige` (~1668)
- Test: `tools/smoke.mjs` — `queuesApp`, `buyQueue` (already written), `seatAgent` (new)

**Interfaces:**
- Consumes: `seatedQueue`, `ownedQueue`, `queueTier`, `queueD`, `queueBandTop`, `agentMult`, `kill9Cost`, `WK`, `money`, `termLine`, `recompute`, `renderAgentSheets`, `renderShop`, `save`. `kill9(a)` is Task 7 — until then the chip's Kill -9 button calls a stub `function kill9(a){}` defined next to `goRogue`.
- Produces: `buildQueues()`, `renderQueues()`, `openPicker(i, anchorEl)`, `closePicker()`, `seatAgent(a, qi) → boolean`, `canSeat(a, qi) → boolean`, module-level `QEL = {boards:[], chips:Map}`.

- [ ] **Step 1: Add the `seatAgent` scenario**

```js
  // Click-to-seat: the picker lists every board with a success readout; choosing Kanban moves the agent and it works Kanban tickets.
  async seatAgent() {
    const kit = (k, il) => ({ id: 60 + ["model","memory","compute","tools"].indexOf(k), slot: k, name: "kit " + k, ilvl: il, patches: [], maxPatches: 3 });
    const s0 = await boot({ fixture: s => { s.intro = false; s.credits = 0; s.earned = 0; s.reveal = { credits: true, shop: true, store: true }; s.up.os = 1; s.up.u_queues = 1; s.unlocked.queues = true;
      s.agents.push({ id: 2, name: "bot", color: "#0ff", gear: Object.fromEntries(["model","memory","compute","tools"].map(k => [k, kit(k, 30)])), inv: [], sanity: 100, q: 0, done: 0, failed: 0, rogue: null });
      s.queues = [{ tier: 0, seats: 2, mods: 0, configs: [] }, { tier: 1, seats: 1, mods: 0, configs: [] }]; }});
    assert(s0.agents[1].q === 0, "bot starts on Backlog");
    let r = await click('#queuesBody .qchip[data-agent="1"]'); assert(r === "ok", "bot chip present"); await sleep(200);
    const opts = await ev(`[...document.querySelectorAll('#qpicker .qopt')].map(o=>o.dataset.q+':'+o.textContent)`);
    assert(opts.length === 3 && opts[0].startsWith("0:") && opts[1].startsWith("1:") && opts[2].startsWith("-1:"), "picker lists Backlog, Kanban, Bench: " + opts);
    assert(/%/.test(opts[1]) && /\/s/.test(opts[1]), "Kanban row shows success % and $/s: " + opts[1]);
    r = await click('#qpicker .qopt[data-q="1"]'); assert(r === "ok", "Kanban option clickable"); await sleep(3500);
    const s1 = await readSave();
    assert(s1.agents[1].q === 1, "bot now seated on Kanban");
    assert(await ev(`!!document.querySelector('#queuesBody .qboard[data-q="1"] .qchip[data-agent="1"]')`), "chip moved to the Kanban board");
    assert(await ev(`!document.querySelector('#qpicker')`), "picker closed after choosing");
    await sleep(20000); const s2 = await readSave();
    assert(s2.agents[1].done + s2.agents[1].failed >= 1, "bot works tickets on Kanban");
    // a full board is refused: agent zero's picker greys Kanban (1 seat, taken)
    r = await click('#queuesBody .qchip[data-agent="0"]'); await sleep(200);
    assert(await ev(`document.querySelector('#qpicker .qopt[data-q="1"]').classList.contains('full')`), "Kanban shows as full for agent zero");
    r = await click('#qpicker .qopt[data-q="1"]'); await sleep(500);
    assert((await readSave()).agents[0].q === 0, "clicking a full board does nothing");
  },
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tools/smoke.mjs seatAgent`
Expected: `FAIL assert: bot chip present`.

- [ ] **Step 3: Implement the app**

Replace `function buildQueues(){}   // replaced in Task 5` with:
```js
  /* ============ Queues app (A&Q Phase 2) ============ */
  // Build-once/update-on-timer like the Store: buildQueues() on structural change (buy, hire, seat, prestige),
  // renderQueues() at 5 Hz for the % / sanity / Kill -9 readouts. Seating always goes through seatAgent().
  const QEL={boards:[],chips:new Map()};
  const agentLabel=a=>a===agentZero()?"you":a.name;
  function canSeat(a,qi){ if(qi<0) return true; const q=P.queues[qi]; if(!q) return false; return a.q===qi || P.agents.filter(x=>x.q===qi).length<q.seats; }
  function seatAgent(a,qi){
    qi=qi<0?-1:qi|0;
    if(!canSeat(a,qi)) return false;
    if(a.q===qi) return true;
    a.q=qi;
    const w=WK[P.agents.indexOf(a)]; if(w){ w.task=null; w.elapsed=0; w.cooldown=0.3; w.el.classList.remove("win","fail","crit"); if(qi<0) assignTask(w); }   // in-flight ticket is abandoned; the Bench tile is relabelled now
    recompute(); buildQueues(); renderAgentSheets(); renderShop(); save();
    termLine("t-git","🪑",agentLabel(a)+(qi<0?" moved to the Bench":" seated on "+queueTier(P.queues[qi]).name));
    return true;
  }
  function chipFor(a,i){
    const c=document.createElement("div"); c.className="qchip"; c.dataset.agent=i; c.style.setProperty("--ac",a.color);
    c.innerHTML=`<span class="dot"></span><span class="nm">${agentLabel(a)}</span><span class="pct"></span><span class="san" title="sanity"><i></i></span><button class="buy k9" data-act="kill9"></button>`;
    c.addEventListener("click",e=>{ if(c.__dragged){ c.__dragged=false; return; } if(e.target.closest(".k9")) return; e.stopPropagation(); openPicker(i,c); });
    c.querySelector(".k9").addEventListener("click",e=>{ e.stopPropagation(); kill9(P.agents[i]); });
    c.addEventListener("pointerdown",e=>chipDragStart(e,i,c));
    QEL.chips.set(i,{el:c,pct:c.querySelector(".pct"),san:c.querySelector(".san i"),k9:c.querySelector(".k9")});
    return c;
  }
  function buildQueues(){
    const body=$("#queuesBody"); if(!body) return; closePicker(); body.innerHTML=""; QEL.boards=[]; QEL.chips=new Map();
    const boards=P.queues.map((q,qi)=>({qi,q,t:queueTier(q)})).concat([{qi:-1,q:null,t:{name:"Bench",em:"🪑",D:0}}]);
    for(const b of boards){
      const el=document.createElement("div"); el.className="qboard card"+(b.qi<0?" bench":""); el.dataset.q=b.qi;
      el.innerHTML=`<div class="qhead"><span class="qem">${b.t.em}</span><b class="qname">${b.t.name}</b><span class="qmeta"></span></div><div class="qseats"></div>`;
      const seats=el.querySelector(".qseats"), seated=P.agents.map((a,i)=>({a,i})).filter(x=>x.a.q===b.qi);
      for(const {a,i} of seated) seats.appendChild(chipFor(a,i));
      if(b.qi>=0) for(let k=seated.length;k<b.q.seats;k++){ const e=document.createElement("div"); e.className="qseat empty"; e.textContent="empty seat"; seats.appendChild(e); }
      body.appendChild(el); QEL.boards.push({...b,el,meta:el.querySelector(".qmeta")});
    }
    renderQueues();
  }
  function renderQueues(){
    if(!QEL.boards.length) return;
    for(const b of QEL.boards){
      if(b.qi>=0){ const n=P.agents.filter(a=>a.q===b.qi).length; b.meta.textContent=`D${b.t.D} · ${n}/${b.q.seats} seats · drops ilvl ${b.t.D}–${Math.round(queueBandTop(b.q))}`; }
      else b.meta.textContent=P.agents.filter(a=>a.q<0).length+" benched · no tickets · full regen";
    }
    for(const [i,c] of QEL.chips){ const a=P.agents[i]; if(!a) continue; if(!a.m) agentMult(a);
      const q=seatedQueue(a); c.pct.textContent=q?Math.round(a.m.chance(queueD(q))*100)+"%":"—";
      c.san.style.width=clamp(a.sanity/a.m.sanityMax*100,0,100)+"%";
      c.el.classList.toggle("rogue",!!a.rogue);
      if(a.rogue){ const k=kill9Cost(a); c.k9.textContent="Kill -9 "+money(k); c.k9.disabled=P.credits<k; c.k9.title="pay to restart "+agentLabel(a)+" at half sanity ("+BAL.rogueImmune+"s immunity)"; }
    }
    const tag=$("#queuesTag"); if(tag) tag.textContent=P.queues.length+" board"+(P.queues.length>1?"s":"")+" · "+P.agents.filter(a=>a.q<0).length+" benched";
  }
  function openPicker(i,anchor){
    closePicker(); const a=P.agents[i]; if(!a.m) agentMult(a);
    const m=document.createElement("div"); m.className="qpicker card"; m.id="qpicker";
    const rows=P.queues.map((q,qi)=>{ const D=queueD(q), ch=a.m.chance(D), t=queueTier(q);
      const ps=i===0?0:ch*a.m.payout(D,q)/(a.m.dur(D)+BAL.cooldown);
      return {qi, lbl:t.em+" "+t.name, sub:"★".repeat(clamp(Math.round(ch*5),1,5))+" "+Math.round(ch*100)+"%"+(i===0?" · typing only":" · "+money(ps)+"/s"), full:!canSeat(a,qi), cur:a.q===qi}; })
      .concat([{qi:-1, lbl:"🪑 Bench", sub:"no tickets · full regen", full:false, cur:a.q<0}]);
    m.innerHTML=rows.map(r=>`<div class="qopt${r.cur?" cur":""}${r.full?" full":""}" data-q="${r.qi}"><b>${r.lbl}</b><span>${r.full?"no free seat":r.sub}</span></div>`).join("");
    m.addEventListener("click",e=>{ e.stopPropagation(); const o=e.target.closest(".qopt"); if(!o||o.classList.contains("full")) return; seatAgent(a,+o.dataset.q); closePicker(); });
    anchor.appendChild(m);
    setTimeout(()=>document.addEventListener("click",closePicker,{once:true}),0);
  }
  function closePicker(){ const m=$("#qpicker"); if(m) m.remove(); }
  let qdrag=null;   // Task 6 wires chipDragStart; this no-op keeps chipFor's listener valid until then
  function chipDragStart(e,i,c){}
```
Wire the callers:
- `tickProgress`: change `storeRefresh=0; renderStore(); renderToolbox(); renderAgentSheets(); }` to `storeRefresh=0; renderStore(); renderToolbox(); renderAgentSheets(); renderQueues(); }`.
- boot: after `buildHUD(); buildWorkers(); buildShop(); …` add `buildQueues();` (after `buildShop()`).
- `doPrestige`: after `recompute(); buildWorkers(); applyUnlocks(); WK.forEach(w=>assignTask(w));` add `buildQueues();`.
- Next to `goRogue` add the temporary stub `function kill9(a){}   // real one in Task 7`.
- In `renderAgentSheets` the tile's `qn` should also refresh after seating — already called from `seatAgent`.

- [ ] **Step 4: Run the scenarios**

Run: `for s in queuesApp buyQueue seatAgent bench storeHire; do node tools/smoke.mjs $s || break; done`
Expected: all `PASS`. Then take a screenshot for a visual check (fixture with two queues): add `--keep` to `seatAgent`, and in a second terminal run
`node -e "..."` is not needed — instead temporarily append `await send("Page.captureScreenshot").then(r=>require("fs").writeFileSync("/tmp/queues.png",Buffer.from(r.data,"base64")))` before the last assert, look at `/tmp/queues.png` (boards stacked, chips readable, picker not clipped), then remove the line.

- [ ] **Step 5: Commit**

```bash
git add index.html tools/smoke.mjs
git commit -m "A&Q Phase 2: Queues app — boards, chips, click-to-seat picker, seatAgent()

The Queues app renders one board per owned queue plus the Bench, with a chip
per seated agent (success %, sanity bar, Kill -9 when rogue) and dashed empty
seats. Clicking a chip opens a picker listing every board with that agent's
success / stars / expected $/s there (full boards greyed); choosing one calls
seatAgent(a, qi) - the single seating mutation: validates capacity, abandons
the in-flight ticket, recomputes, rebuilds, saves. buildQueues() is called on
every structural change (buy, hire, seat, prestige, boot); renderQueues()
rides the 5 Hz Store refresh. Smoke: seatAgent added; queuesApp/buyQueue now
pass end to end.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Drag-and-drop sugar

**Files:**
- Modify: `index.html` — replace the `chipDragStart` no-op from Task 5 (same block)
- Test: manual (screenshot) + existing `seatAgent` must still pass (click path unaffected)

**Interfaces:**
- Consumes: `QEL`, `canSeat`, `seatAgent`, `uiZoom`.

- [ ] **Step 1: Implement pointer-event drag**

Replace
```js
  let qdrag=null;   // Task 6 wires chipDragStart; this no-op keeps chipFor's listener valid until then
  function chipDragStart(e,i,c){}
```
with
```js
  // Drag is sugar over seatAgent(): pointer events (works on touch), a 6 px dead zone so a click still opens the
  // picker, and rect math divided by uiZoom like the window drag code. The dragged chip gets pointer-events:none so
  // elementFromPoint sees the board underneath.
  let qdrag=null;
  function chipDragStart(e,i,c){ if(e.button!==0||e.target.closest(".k9")) return; qdrag={i,c,sx:e.clientX,sy:e.clientY,moved:false}; c.setPointerCapture(e.pointerId); }
  const boardAt=(x,y)=>{ const el=document.elementFromPoint(x,y), b=el&&el.closest(".qboard"); return b?QEL.boards.find(q=>q.el===b):null; };
  document.addEventListener("pointermove",e=>{ if(!qdrag) return;
    const dx=(e.clientX-qdrag.sx)/uiZoom, dy=(e.clientY-qdrag.sy)/uiZoom;
    if(!qdrag.moved){ if(Math.hypot(dx,dy)<6) return; qdrag.moved=true; qdrag.c.classList.add("dragging"); closePicker(); }
    qdrag.c.style.transform=`translate(${dx}px,${dy}px)`;
    const tgt=boardAt(e.clientX,e.clientY), a=P.agents[qdrag.i];
    for(const b of QEL.boards) b.el.classList.toggle("over",!!tgt&&b===tgt&&canSeat(a,b.qi)); });
  document.addEventListener("pointerup",e=>{ if(!qdrag) return; const d=qdrag; qdrag=null;
    d.c.classList.remove("dragging"); d.c.style.transform=""; for(const b of QEL.boards) b.el.classList.remove("over");
    if(!d.moved) return; d.c.__dragged=true;
    const tgt=boardAt(e.clientX,e.clientY); if(tgt) seatAgent(P.agents[d.i],tgt.qi); });
  document.addEventListener("pointercancel",()=>{ if(!qdrag) return; qdrag.c.classList.remove("dragging"); qdrag.c.style.transform=""; for(const b of QEL.boards) b.el.classList.remove("over"); qdrag=null; });
```

- [ ] **Step 2: Verify**

Run: `node tools/smoke.mjs seatAgent && node tools/smoke.mjs queuesApp`
Expected: both `PASS` (click path unchanged). Then a manual drag check: `node tools/smoke.mjs seatAgent --keep` leaves Chrome up on `localhost:<port>`; open `http://localhost:<port>` in a normal browser is not possible for headless — instead verify drag with a one-off CDP script following `CLAUDE.md`'s recipe: `Input.dispatchMouseEvent` `mousePressed` on the bot chip's centre, three `mouseMoved` steps to the Bench board's centre, `mouseReleased`; then `readSave().agents[1].q === -1`. Delete the script afterwards (do not add it to the harness — pointer capture across dispatched mouse events is flaky enough that it would be a false-negative generator).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "A&Q Phase 2: drag chips between boards (sugar over seatAgent)

Pointer-event drag on Queues-app chips with a 6 px dead zone (a plain click
still opens the picker), uiZoom-corrected deltas, a highlighted drop target
only when the board has a free seat, and pointer-events:none on the dragged
chip so elementFromPoint finds the board. Drops call seatAgent(), so the
click-picker and drag share one code path.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Rogue proper — Embezzler tick, Kill -9, immunity, tile UI

**Files:**
- Modify: `index.html` — `ROGUE_MODES`/`goRogue`/`recoverRogue`/`kill9` (Task 2/5 stubs), `buildWorkers` tile template (~2270), `renderAgentSheets` (~2293), `tickProgress` HUD (agent zero rogue), `cacheUI` not needed
- Test: `tools/smoke.mjs` — `rogue` (new)

**Interfaces:**
- Consumes: `kill9Cost`, `ROGUE_MODES`, `renderQueues`, `renderShop`, `money`, `celebrate`, `flashHp`, `agentLabel`.
- Produces: real `goRogue(a)`, `recoverRogue(a, how)`, `kill9(a)`; tile button `.agent .k9`; `.agent.rogue` class.

- [ ] **Step 1: Add the `rogue` scenario**

```js
  // An agent that can't hold its queue goes rogue: it stops working, embezzles credits every second, and Kill -9
  // (priced off its gear) restarts it at half sanity with immunity. Covers the Phase 1 residual burnout → recovery path.
  async rogue() {
    const kit = k => ({ id: 60 + ["model","memory","compute","tools"].indexOf(k), slot: k, name: "kit " + k, ilvl: 10, patches: [], maxPatches: 2 });
    const s0 = await boot({ fixture: s => { s.intro = false; s.credits = 1000; s.earned = 0; s.reveal = { credits: true, shop: true, store: true }; s.up.os = 1; s.up.u_queues = 1; s.unlocked.queues = true;
      // ilvl 10 kit → Quality 20 vs Kanban D25 → 25% success; sanity 5 → the first failure (-23) sends it rogue
      s.agents.push({ id: 2, name: "bot", color: "#0ff", gear: Object.fromEntries(["model","memory","compute","tools"].map(k => [k, kit(k)])), inv: [], sanity: 5, q: 1, done: 0, failed: 0, rogue: null });
      s.queues = [{ tier: 0, seats: 1, mods: 0, configs: [] }, { tier: 1, seats: 1, mods: 0, configs: [] }]; }});
    let s1, waited = 0;
    while (waited < 60000) { await sleep(3000); waited += 3000; s1 = await readSave(); if (s1.agents[1].rogue) break; }
    assert(s1.agents[1].rogue && s1.agents[1].rogue.mode === "embezzler", "bot went rogue within 60s");
    assert(s1.rogues === 1, "P.rogues counted it");
    const c1 = s1.credits, done1 = s1.agents[1].done + s1.agents[1].failed;
    await sleep(6000); const s2 = await readSave();
    assert(s2.credits < c1, "Embezzler drains credits while rogue (" + c1 + " → " + s2.credits + ")");
    assert(s2.stolen > 0 && s2.agents[1].rogue.stolen > 0, "stolen counters accumulate");
    assert(s2.agents[1].done + s2.agents[1].failed === done1, "rogue agent works no tickets");
    assert(await ev(`document.querySelector('#queuesBody .qchip[data-agent="1"]').classList.contains('rogue')`), "chip shows rogue");
    const k9 = await ev(`document.querySelector('#queuesBody .qchip[data-agent="1"] .k9').textContent`);
    assert(/Kill -9 \$320/.test(k9), "Kill -9 priced at 8 × 40 ilvl = $320, got " + k9);
    const r = await click('#queuesBody .qchip[data-agent="1"] .k9'); assert(r === "ok", "Kill -9 button");
    await sleep(3500); const s3 = await readSave();
    assert(s3.agents[1].rogue === null, "Kill -9 clears rogue");
    assert(Math.abs(s3.credits - (s2.credits - 320)) < 5, "Kill -9 cost $320 (" + s2.credits + " → " + s3.credits + ")");
    assert(s3.agents[1].sanity >= 40, "restarted at ~half sanity (max 90 → 45), got " + s3.agents[1].sanity);
    assert(!("immune" in s3.agents[1]), "immune is not persisted");
    await sleep(10000); const s4 = await readSave();   // still inside the 20 s immunity: failures can't re-rogue it
    assert(s4.agents[1].rogue === null && s4.agents[1].sanity >= 1, "immune agent cannot go rogue again yet");
  },
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tools/smoke.mjs rogue`
Expected: `FAIL assert: Embezzler drains credits while rogue` (tick is a no-op) or the Kill -9 text assert.

- [ ] **Step 3: Implement**

Replace the `ROGUE_MODES` stub, `goRogue`, `recoverRogue`, and the `kill9` stub with:
```js
  // Rogue modes (doc §3). Phase 2 ships one; Phase 4 adds rows, escalation and Countermeasures — never branches here.
  // tick(a,dt,w) runs at the top of tickWorker for every rogue agent (benched too), so it pauses with the boss key
  // and never runs offline (offlineEarnings skips rogues).
  const ROGUE_MODES={
    embezzler:{lbl:"Embezzler", em:"💸", desc:"siphons a slice of your bank every second",
      tick(a,dt,w){ const take=Math.min(P.credits,P.credits*BAL.rogueSteal*dt); if(take<=0) return;
        P.credits-=take; a.rogue.stolen+=take; P.stolen+=take;
        if(w){ w.dripT=(w.dripT||0)+dt; if(w.dripT>=10){ w.dripT=0; termLine("t-bad","💸",agentLabel(a)+" embezzled "+money(a.rogue.stolen)+" so far — Kill -9 for "+money(kill9Cost(a))); } } }},
  };
  function goRogue(a){
    P.rogues++; a.rogue={mode:"embezzler",t:0,stolen:0}; a.sanity=0; P.streak=0;
    const w=WK[P.agents.indexOf(a)]; if(w){ w.task=null; w.dripT=0; w.el.classList.remove("win","fail","crit"); w.tk.textContent="gone rogue"; w.sTag.textContent=""; w.dEl.textContent=""; w.prog.style.width="0%"; }
    const M=ROGUE_MODES[a.rogue.mode], nm=agentLabel(a);
    celebrate("☠ "+nm.toUpperCase()+" WENT ROGUE","#ff2b5e"); if(a===agentZero()) flashHp();
    toast("☠ Rogue — "+M.lbl, nm+" "+M.desc+" · Kill -9 for "+money(kill9Cost(a))+" or wait it out", "#ff2b5e","progress");
    termLine("t-bad","☠",nm+" went ROGUE ("+M.em+" "+M.lbl+") — sanity hit zero");
    renderAgentSheets(); renderQueues(); save();
  }
  function recoverRogue(a,how){
    const st=a.rogue.stolen; a.rogue=null;
    termLine("t-info","☕",agentLabel(a)+" "+how+(st>0?" — embezzled "+money(st)+" in total":""));
    renderAgentSheets(); renderQueues(); save();
  }
  function kill9(a){
    if(!a.rogue) return; const c=kill9Cost(a);
    if(P.credits<c){ toast("💸 Can't afford Kill -9","need "+money(c)+" — or wait for sanity to recover","#ffb000","system"); return; }
    P.credits-=c; if(!a.m) agentMult(a); a.sanity=a.m.sanityMax*0.5; a.immune=BAL.rogueImmune;
    recoverRogue(a,"was killed -9 and restarted at half sanity ("+BAL.rogueImmune+"s immunity) for "+money(c));
    toast("⚡ Kill -9",agentLabel(a)+" restarted · "+money(c),"#00e5ff","system"); renderShop();
  }
```
Agent-tile UI in `buildWorkers`: in the tile template change the `<button class="buy sel" …>Select</button>` to `<button class="buy sel" data-act="select" data-agent="${i}">Select</button><button class="buy k9" data-act="kill9" data-agent="${i}"></button>` and cache it in the worker object (`k9:el.querySelector(".k9"),`), then after `w.sel.addEventListener(...)` add `w.k9.addEventListener("click",e=>{e.stopPropagation();kill9(a);});`.
In `renderAgentSheets` after the `w.qn.textContent=…` line add:
```js
      w.el.classList.toggle("rogue",!!a.rogue);
      w.k9.style.display=a.rogue?"":"none"; if(a.rogue){ const k=kill9Cost(a); w.k9.textContent="Kill -9 "+money(k); w.k9.disabled=P.credits<k; }
```
CSS, next to `.agent.fail{…}`: `.agent.rogue{border-color:var(--red);box-shadow:0 0 16px rgba(255,43,94,.35) inset} .agent .k9{font-size:9px;padding:1px 6px}`.

- [ ] **Step 4: Run**

Run: `node tools/smoke.mjs rogue && node tools/smoke.mjs bench && node tools/smoke.mjs loopEarns`
Expected: all `PASS`.

- [ ] **Step 5: Commit**

```bash
git add index.html tools/smoke.mjs
git commit -m "A&Q Phase 2: rogue agents embezzle; Kill -9 with immunity

ROGUE_MODES.embezzler ticks at the top of tickWorker for every rogue agent
(benched included): it takes BAL.rogueSteal x bank per second (never below
zero), accumulating on a.rogue.stolen and the lifetime P.stolen, with a
terminal drip line every ~10 s. goRogue() clears the tile and announces the
mode; recovery is either sanity reaching 50% at BAL.rogueRegen x regen or
Kill -9: BAL.kill9PerIlvl x summed gear ilvl, restart at half sanity, and
BAL.rogueImmune seconds during which sanity floors at 1. Kill -9 buttons live
on the Queues-app chip and the Agents-app tile. Smoke: rogue added.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Offline earnings — rogue and Bench are skipped, rogue state freezes

**Files:**
- Modify: `index.html` `offlineEarnings` (Task 2 already added the skip — this task verifies it and fixes the welcome-back copy)
- Test: `tools/smoke.mjs` — `offline` (new)

- [ ] **Step 1: Add the `offline` scenario**

```js
  // While the tab is closed only seated, sane agents earn; a rogue neither steals nor recovers; the Bench earns nothing.
  async offline() {
    const kit = (k, il) => ({ id: 60 + ["model","memory","compute","tools"].indexOf(k), slot: k, name: "kit " + k, ilvl: il, patches: [], maxPatches: 2 });
    const mk = (id, name, q, extra) => Object.assign({ id, name, color: "#0ff", gear: Object.fromEntries(["model","memory","compute","tools"].map(k => [k, kit(k, 10)])), inv: [], sanity: 100, q, done: 0, failed: 0, rogue: null }, extra);
    const s0 = await boot({ fixture: s => { s.intro = false; s.credits = 1000; s.earned = 0; s.reveal = { credits: true, shop: true, store: true }; s.up.os = 1; s.up.u_queues = 1; s.unlocked.queues = true;
      s.up.offline = 1; s.lastReal = Date.now() - 3600 * 1000;   // an hour away with Cloud Sync
      s.agents.push(mk(2, "worker", 0), mk(3, "thief", 0, { sanity: 0, rogue: { mode: "embezzler", t: 0, stolen: 0 } }), mk(4, "bench", -1));
      s.queues = [{ tier: 0, seats: 3, mods: 0, configs: [] }]; }});
    const gain = s0.earned;   // offline gain is credited at boot, before the fixture's reload-save
    assert(gain > 0, "seated sane agent earned offline");
    // credits = 1000 + offline gain + ≤7 s of live play; the rogue steals live at ~0.26%/s, so allow 3%
    assert(Math.abs((s0.credits - 1000) - s0.earned) < 0.03 * s0.credits + 1, "no offline steal: credits " + s0.credits + " vs earned " + s0.earned);
    assert(s0.agents[2].rogue && s0.agents[2].sanity < 5, "rogue state frozen while away (no offline recovery)");
    assert(s0.stolen < 0.03 * s0.credits + 1, "rogue stole nothing offline");
    assert(s0.agents[3].done === 0, "benched agent did nothing");
    const rate1 = gain / 3600;   // per second, at the game's 50% offline efficiency
    assert(rate1 < 20, "gain must be ONE ilvl-10 Backlog agent's rate (~$2–3/s at 50%), got " + rate1.toFixed(2) + "/s");
  },
```

- [ ] **Step 2: Run**

Run: `node tools/smoke.mjs offline`
Expected: `PASS` if Task 2's skip is correct. If it fails on "rogue stole nothing offline" or the rate bound, `offlineEarnings` still counts a rogue/benched agent — fix the loop to `if(a.rogue||a.q<0) continue;` and re-run.

- [ ] **Step 3: Welcome-back copy**

In `showWelcomeBack` the modal has `set("wbEff","50%")` — leave; in the `offlineEarnings` terminal line change `"offline earnings: +"+money(gain)+" ("+Math.round(el/60)+" min away)"` to `"offline earnings: +"+money(gain)+" ("+Math.round(el/60)+" min away · rogue and benched agents sat out)"` only when `P.agents.some(a=>a.rogue||a.q<0)` — implement as:
```js
      const idle=P.agents.slice(1).filter(a=>a.rogue||a.q<0).length;
      termLine("t-info","🌙","offline earnings: +"+money(gain)+" ("+Math.round(el/60)+" min away"+(idle?" · "+idle+" rogue/benched sat out":"")+")");
```

- [ ] **Step 4: Commit**

```bash
git add index.html tools/smoke.mjs
git commit -m "A&Q Phase 2: offline earnings skip rogue and benched agents

Cloud Sync only credits seated, sane agents; a rogue neither steals nor
recovers while the tab is closed (same paused-while-away rule the spec uses
for bounties) and the Bench earns nothing. The terminal line says who sat
out. Smoke: offline added.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Validator fixture, docs, spec status, full pass

**Files:**
- Modify: `tools/validate-rate.mjs:30-36`, `tools/aq-sim.mjs` (`--probe` block ~197), `guide.md` (§ Sanity and burnout, § Hiring and seats, § Queues, § The Store › Team, § Achievements copy, § Prestige), `README.md:17-35`, `CLAUDE.md` (Current state, Architecture, Verifying), `docs/agents-and-queues.md` (`## Status`, Phase 2 checkboxes)

- [ ] **Step 1: Validator + probe learn queues and seating**

`tools/validate-rate.mjs`: replace lines
```js
const nAgents = F.agents ?? 3, ilvl = F.ilvl ?? 10;
…
fixture.agents = Array.from({ length: nAgents }, (_, i) => ({ id: i + 1, name: i ? "bot" + i : "you", color: "#0ff", gear: kit(), inv: [], sanity: 100, q: 0, done: 0, failed: 0 }));
fixture.queues = [{ tier: 0, seats: nAgents, mods: 0, configs: [] }];
```
with
```js
const nAgents = F.agents ?? 3, ilvl = F.ilvl ?? 10;
// Optional: F.queues = [{tier, seats}], F.seat = [q per agent] (−1 = Bench). Default: everyone on one Backlog.
const queues = F.queues ?? [{ tier: 0, seats: nAgents }], seat = F.seat ?? Array(nAgents).fill(0);
…
fixture.agents = Array.from({ length: nAgents }, (_, i) => ({ id: i + 1, name: i ? "bot" + i : "you", color: "#0ff", gear: kit(), inv: [], sanity: 100, q: seat[i], done: 0, failed: 0, rogue: null }));
fixture.queues = queues.map(q => ({ tier: q.tier, seats: q.seats, mods: 0, configs: [] }));
fixture.up.os = Math.max(...queues.map(q => q.tier));   // the OS that can own the highest queue (ILVL_CAP/HIRE_CAP consistent with the sim)
```
(and drop the `up: Object.assign(fixture.up, { os: 0 })` part of the `Object.assign(fixture, {...})` line, since `os` is now set after).
`tools/aq-sim.mjs` `--probe`: replace the `S` construction with
```js
  const F = JSON.parse(process.env.FIX || "{}"); const n = F.agents ?? 3, il = F.ilvl ?? 10;
  const queues = F.queues ?? [{ tier: 0, seats: n }], seat = F.seat ?? Array(n).fill(0);
  const S = initial(); S.os = Math.max(...queues.map(q => q.tier)); S.queues = queues.map(q => ({ tier: q.tier, seats: q.seats, mods: 0 }));
  S.agents = Array.from({ length: n }, (_, i) => newAgent(il, seat[i])); S.hires = n;
  for (const k of [0, 2]) { let cr = 0, succ = 0, tot = 0; S.agents.forEach((a, i) => { if (a.q < 0) return; const r = agentRate(a, S.queues[a.q], k, i === 0); cr += r.credits; succ += r.succ; tot += r.tps * r.uptime; });
```
Run both on a two-queue fixture and compare:
`FIX='{"agents":3,"ilvl":30,"queues":[{"tier":0,"seats":2},{"tier":1,"seats":1}],"seat":[0,0,1]}' node tools/aq-sim.mjs --probe --craft 0`
`FIX='{"agents":3,"ilvl":30,"queues":[{"tier":0,"seats":2},{"tier":1,"seats":1}],"seat":[0,0,1]}' node tools/validate-rate.mjs 0 60`
Expected: `creditsPerSec` at kps 0 agree within ~20 %. If not, the drift is in one of `queueD`/`payout`/`dur` between the two files — find and fix it, don't widen the tolerance.

- [ ] **Step 2: `guide.md`**

- Rename "### Sanity and burnout" → "### Sanity and going rogue". Replace its bullets about burnout/coffee break with: sanity hits zero ⇒ the agent **goes rogue** (Phase 2 mode: **Embezzler** — it stops working and siphons a fraction of your *current bank* every second, never below zero, with the running total in the Terminal); it recovers on its own when sanity climbs back to 50 % (regen runs at half speed while rogue); or **Kill -9** it from its chip in the Queues app / its tile in Agent Swarm: costs `8 × (summed item level of its gear)`, restarts it at half sanity with a 20 s grace during which it can't go rogue again. Rule of thumb: if your bank is more than ~4× the Kill -9 price, pay; if you're broke, wait. Applies to you too. Delete the "(A later phase turns burnout into agents going rogue…)" parenthetical.
- "### Hiring and seats": replace the "🪑 Backlog Seat" bullet with "🪑 *Queue* Seat — one card per board you own (`150 × 2.2^(seats so far) × 4^tier`); a board can't have more seats than your OS's hire cap" and change the hire bullet's "needs a free seat" note to "if no seat is free the new hire waits on the **Bench**".
- "## Queues": add the Queues app paragraph — bought as **📋 Open the Queues app** ($2,000, Getting Started); until then the Backlog is just "the queue" your terminal works. Boards: one per owned queue plus the **Bench**. Each **Install <queue>** card ($2K Kanban, $20K Jira, $200K PagerDuty, $2M The Roadmap, $15M Legacy Monolith) needs the previous board and the matching OS. Seating: click a chip → picker with success %, ★ and expected $/s per board, or drag the chip onto a board; full boards are greyed. Benched agents work nothing and regen at full rate.
- "### Team" under The Store: "**👥 Hire an Agent**, **🪑 <Queue> Seat** (one per owned board) and **Install <Queue>** — see Hiring and seats / Queues. The whole section appears once you own the Queues app."
- "## Achievements": Touch Grass → "watch an agent go rogue".
- "## Prestige": "hires, seats and queues" in the reset list if not already.
- Any remaining `grep -n -i "burnout\|coffee" guide.md` hits → rewrite in rogue terms.

- [ ] **Step 3: `README.md`**

Lines 17–35: replace "burns out and takes a coffee break until it recovers" with "goes rogue — off the board and skimming your bank — until it recovers or you Kill -9 it"; in the Credits sentence add "**queues** (boards you install)"; in the Queues bullet add "— bought in order from the Store, managed in the **Queues app** (click or drag agents between boards, or park them on the Bench)".

- [ ] **Step 4: `CLAUDE.md`**

- "Current state": replace the "**Phase 1 is shipped** … Phase 2 (queues as purchases, seating UI, rogue agents) is next." sentence with: "**Phases 1 and 2 are shipped on that branch**: … (Phase 1 list) … and Phase 2 added queues as Store purchases generated from `QUEUE_TIERS`, the Queues app (boards, chips, click-picker + drag seating through `seatAgent()`, the Bench at `a.q = -1`), and rogue agents (`ROGUE_MODES`, Embezzler, Kill -9 with immunity). Phase 3 (Configs + bounties) is next."
- Architecture bullets: in the "Agents and queues are the two state arrays" bullet update the agent shape to `{…, q (−1 = Bench), done, failed, rogue:{mode,t,stolen}|null}` and the runtime-only list to `a.m` and `a.immune`; add a bullet: "**`seatAgent(a, qi)` is the only way an agent changes queue** after hire — it validates capacity, abandons the in-flight ticket, recomputes and rebuilds the Queues app. `seatedQueue(a)` returns `null` on the Bench; never fall back to `P.queues[0]`."; add a bullet: "**Rogue is a table, not branches.** `ROGUE_MODES[mode].tick(a,dt,w)` runs at the top of `tickWorker` (so it pauses with the boss key and never runs offline); new modes are rows. `kill9Cost(a)` is `BAL.kill9PerIlvl × Σ gear ilvl`."; in the Store bullet mention the generated `q_<tier>`/`seat_<tier>` cards and that `isRevealed` owns Team-section visibility.
- "Verifying changes": update the scenario list and the loop command to `boots stateShape loopEarns storeHire seatGate noOldSystems perAgentGear queuesApp buyQueue seatAgent bench rogue offline`; note `validate-rate.mjs`/`--probe` accept `queues`/`seat` in `FIX`.

- [ ] **Step 5: Spec status**

`docs/agents-and-queues.md`: tick all four Phase 2 checkboxes; rewrite `## Status`'s first paragraph to "**Phases 1–2 shipped on branch `agents-and-queues` (2026-09-17).** …" listing Phase 2's deliverables (queues as Store purchases, Queues app with click/drag seating and Bench, Embezzler rogue + Kill -9, offline rules, BAL rogue knobs derived in the sim, validator two-queue fixtures) and "**Next: Phase 3 — Configs + bounties.**"; strike the residuals that Phase 2 closed (burnout → recovery path now covered by `rogue`; the Backlog reveal now owned by the Queues app) and leave the rest.

- [ ] **Step 6: Full verification pass**

Run:
```bash
for s in boots stateShape loopEarns storeHire seatGate noOldSystems perAgentGear queuesApp buyQueue seatAgent bench rogue offline; do node tools/smoke.mjs $s || break; done
node tools/aq-sim.mjs --checks
grep -n "burnout\|\.down\b\|P.queues\[a.q\]||\|P.queues\[0\]\.seats" index.html
```
Expected: 13 × `PASS`, all checks `✓`, grep prints nothing.

- [ ] **Step 7: Commit**

```bash
git add tools/validate-rate.mjs tools/aq-sim.mjs guide.md README.md CLAUDE.md docs/agents-and-queues.md
git commit -m "A&Q Phase 2 complete: docs, validator fixtures, spec status

guide.md/README.md describe the Queues app, seating, the Bench, rogue agents
and Kill -9; CLAUDE.md records seatAgent()/seatedQueue(), ROGUE_MODES, the
generated Store cards and the 13-scenario smoke list; validate-rate.mjs and
aq-sim --probe accept FIX.queues / FIX.seat so multi-queue states can be
checked against the model. docs/agents-and-queues.md Status now reads
'Phases 1-2 shipped', Phase 2 boxes ticked, next: Phase 3.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Self-review (done while writing)

- **Spec coverage** — §1 state/store: Tasks 2, 3. §2 app/seating: Tasks 4, 5, 6. §3 rogue: Tasks 2 (fields), 7. §4 sim/smoke/docs: Tasks 1, 8, 9. Every `a.q` consumer named in §1 is edited in Task 2 Step 5. Auto-Buyer rule: Task 3 Step 4. `renderStore` per-tier: Task 3. `WIN_LAYOUT` arithmetic: Task 4. `P.rogues`/`P.stolen` in prestige keep: Task 2. `a.rogue.t`: Task 2. Null-slot guard: `kill9Cost` in Task 2.
- **Type consistency** — `seatAgent(a, qi)` (agent object, index) everywhere; `ROGUE_MODES[mode].tick(a, dt, w)` in Tasks 2 and 7; `ownedQueue(tier)` vs `seatedQueue(a)` distinct; card ids `u_queues`, `q_<id>`, `seat_<id>` match the smoke selectors (`seat_backlog`, `q_kanban`, `seat_kanban`, `q_jira`).
- **Known ordering hazards** — Task 3 references `buildQueues()`/`kill9()` before Tasks 5/7 define them: both tasks add explicit stubs and later replace them. `queuesApp`/`buyQueue` are written in Task 3 and only fully pass after Task 5 — stated in both tasks.
