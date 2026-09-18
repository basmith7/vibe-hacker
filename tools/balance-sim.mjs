#!/usr/bin/env node
// Balance simulator for vibe hacker (throwaway spike, 2026-09-16).
//
// Reimplements the game's economy formulas (copied from index.html — the game is an IIFE, so the
// tables aren't importable) as an EXPECTED-VALUE model, then:
//   1. rate(state)            → expected credits/sec + xp/sec for a state
//   2. payback table          → for every purchasable, cost / Δrate (seconds to earn its price back)
//   3. greedy playthrough     → a bot that buys whatever minimises (time-to-afford + payback),
//                               logging every purchase and when each OS / rig tier is reached
//
// Usage:  node tools/balance-sim.mjs [--kps 2] [--hours 24] [--patches 2] [--table]
//   --kps     keypresses/sec the player sustains (0 = pure idle). Keypresses: +0.9 surge,
//             mashCode (manual worker +9% task), +0.05s to every agent task, +1 xp, +0.3 plot.
//   --hours   how long to simulate
//   --patches expected patches per equipped item (crafting depth knob; 3+ turns set bonus on)
//   --skills  force the bot to learn skills when cheap (it never would on its own — see findings)
//   --table   also print the full payback table at every OS tier reached
//
// Things deliberately NOT modelled (all expected-value approximations, see README of findings):
//   HP/burnout (assumed regen keeps up), missions/materials (folded into --patches), Legendary
//   Builds, prestige/Equity, Deep Work, offline earnings, mission favouring of task pool.

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) =>
  a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : []).filter(x => x.length));
const KPS = +(args.kps ?? 2);
const HOURS = +(args.hours ?? 24);
const PATCHES = +(args.patches ?? 2);
const TABLE = !!args.table;
// --tune '{...}' : override balance knobs (defaults = live game values) to try a rebalance
const T = Object.assign({
  machMult: null,        // array of 7 multipliers replacing MACH[].mult
  machSpeed: null,       // array of 7 replacing MACH[].speed
  surgeAgent: 1.1,       // agent elapsed rate = 1 + surge*surgeAgent  (surge idles at 1)
  surgeIdle: 1,          // value surge decays to (1 in game). 0 → idle agents run at 1x
  surgeCd: 0.5,          // cooldown rate = 1 + surge*surgeCd
  durMin: 1.1,           // task duration floor
  ilvlSpeed: 0.02, ilvlXp: 0.03, ilvlCredit: 0.025, ilvlPassive: 0.15,
  rollMult: 0,           // roll cost = (15+3·level) · (1 + rollMult·(MACH mult−1))
  statGainDecay: 0,      // per-success stat gain = 0.7 / (1 + stat·statGainDecay)
  costMult: 1,           // global multiplier on every tier cost (hire/machine/model/os)
  modelSpeed: null,      // replace MODEL[].speed
  xpGrowth: 1.10,        // xpNeed growth per level
  patchScale: 1,         // multiplier on every patch value (crafting emphasis)
  patchTier: 0,
  skillStart: 0,
  modelMult: null,       // per-MODEL-tier multiplier on credits+xp (proposal: give the Model a value role)
  skillBonus: 0,         // +credits/xp fraction per learned skill (versatility)         // 0 = new stat starts at its rolled ~9 (game today); 0.8 = starts at 80% of your average unlocked stat          // 0/1/2 → which PATCH_DEFS tier the expected patches sit at
}, args.tune ? JSON.parse(args.tune) : {});

/* ================= tables (verbatim from index.html; T.* may override) ================= */
const STAT_IDS = ["coding", "focus", "debug", "systems", "algo"];
const MACH = [
  { name: "Hand-me-down Laptop", mult: 1, speed: 1, cost: 0 },
  { name: "Gaming Rig", mult: 1.8, speed: 1.15, cost: 800 },
  { name: "Mac Studio", mult: 3.4, speed: 1.3, cost: 9000 },
  { name: "Threadripper Workstation", mult: 6.5, speed: 1.5, cost: 95000 },
  { name: "Liquid-Cooled Beast", mult: 13, speed: 1.7, cost: 950000 },
  { name: "Quantum Rig", mult: 32, speed: 2.2, cost: 1.3e7 },
  { name: "Dyson-Sphere Cluster", mult: 90, speed: 3, cost: 2.2e8 },
];
const MODEL = [
  { name: "Naive Autocomplete", success: 0, speed: 1, cost: 0 },
  { name: "GPT-2 (2019)", success: .03, speed: 1.05, cost: 500 },
  { name: "GPT-4", success: .06, speed: 1.12, cost: 6500 },
  { name: "Claude Sonnet", success: .09, speed: 1.2, cost: 70000 },
  { name: "Claude Opus 4.8", success: .12, speed: 1.32, cost: 750000 },
  { name: "AGI (do not release)", success: .16, speed: 1.55, cost: 9e6 },
];
const HIRE = [0, 60, 650, 5500, 42000, 350000, 3e6, 2.6e7].map((cost, i) => ({ name: i ? `agent #${i}` : "just you", cost }));
const OS_TIERS = [
  { id: "dos", name: "MS-DOS 6.22", cost: 0 }, { id: "win31", name: "Windows 3.1", cost: 650 },
  { id: "win95", name: "Windows 95", cost: 7500 }, { id: "win10", name: "Windows 10", cost: 80000 },
  { id: "neon", name: "NEON//OS v6", cost: 850000 }, { id: "spaceage", name: "STARSHIP OS", cost: 9500000 },
];
const HIRE_CAP = [1, 2, 4, 6, 7, 7];
const ILVL_CAP = [40, 80, 140, 220, 340, 520];
const SLOTS = [
  { id: "ram", os: 0 }, { id: "cpu", os: 0 }, { id: "harddrive", os: 0 }, { id: "monitor", os: 1 },
  { id: "modem", os: 2 }, { id: "gpu", os: 3 }, { id: "cooling", os: 4 }, { id: "neural", os: 5 },
];
// slot patch tier-0 values (PATCH_DEFS) — what one "slot" patch is worth
const SLOT_PATCH_T = { ram: [.03,.06,.10], cpu: [.04,.08,.14], harddrive: [.04,.08,.14], monitor: [.05,.10,.18], gpu: [.02,.04,.07], modem: [.02,.04,.06], cooling: [.10,.20,.35], neural: [.02,.04,.07] };
const STAT_PATCH_T = [1, 2, 4];
const UPG = [
  { id: "hire", kind: "tier", tiers: HIRE },
  { id: "skill", kind: "skill", base: 120, growth: 2.15 },
  { id: "u_status", kind: "unlock", cost: 25 }, { id: "u_achv", kind: "unlock", cost: 150 },
  { id: "u_tele", kind: "unlock", cost: 400 }, { id: "u_inv", kind: "unlock", cost: 500 },
  { id: "u_equip", kind: "unlock", cost: 700 }, { id: "u_ide", kind: "unlock", cost: 1000 },
  { id: "u_globe", kind: "unlock", cost: 1400 }, { id: "u_missions", kind: "unlock", cost: 1800 },
  { id: "assist", kind: "repeat", base: 150, growth: 1.25, max: 15 },
  { id: "coffee", kind: "repeat", base: 90, growth: 1.22 },
  { id: "computer", kind: "tier", tiers: MACH },
  { id: "model", kind: "tier", tiers: MODEL },
  { id: "os", kind: "tier", tiers: OS_TIERS },
  { id: "roll", kind: "roll" },   // Toolbox gamble: 15+3·level, random unlocked slot, ilvl≈level (capped)
];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
if (T.machMult) MACH.forEach((m, i) => m.mult = T.machMult[i]);
if (T.machSpeed) MACH.forEach((m, i) => m.speed = T.machSpeed[i]);
if (T.modelSpeed) MODEL.forEach((m, i) => m.speed = T.modelSpeed[i]);
for (const arr of [MACH, MODEL, HIRE, OS_TIERS]) for (const t of arr) t.cost = Math.round(t.cost * T.costMult);

/* ================= state ================= */
function initial() {
  const stats = {}; STAT_IDS.forEach(id => stats[id] = 9);   // rand(6,12) → mean 9
  return {
    t: 0, level: 1, xp: 0, xpNeed: 100, stage: 0, plot: 0, plotNeed: 120, sp: 0,
    stats, unlocked: ["coding"], credits: 0,
    up: { hire: 0, skill: 0, assist: 0, coffee: 0, computer: 0, model: 0, os: 0, u_status: 0, u_achv: 0, u_tele: 0, u_inv: 0, u_equip: 0, u_ide: 0, u_globe: 0, u_missions: 0 },
    ilvl: Object.fromEntries(SLOTS.map(s => [s.id, 0])),   // 0 = slot empty
  };
}
const clone = s => JSON.parse(JSON.stringify(s));

/* ================= upCost / gates (mirrors upCost/osLock) ================= */
function upCost(u, S) {
  if (u.kind === "repeat") { if (u.max && S.up[u.id] >= u.max) return null; return Math.floor(u.base * Math.pow(u.growth, S.up[u.id])); }
  if (u.kind === "unlock") return S.up[u.id] >= 1 ? null : u.cost;
  if (u.kind === "skill") { const n = S.unlocked.length; if (n >= STAT_IDS.length) return null; return Math.floor(u.base * Math.pow(u.growth, n - 1)); }
  if (u.kind === "roll") return S.up.u_inv ? Math.round((15 + S.level * 3) * (1 + T.rollMult * (MACH[S.up.computer].mult - 1))) : null;
  const nxt = S.up[u.id] + 1; return u.tiers[nxt] ? u.tiers[nxt].cost : null;
}
function osLock(u, S) {
  let need = null;
  if (u.id === "hire") need = HIRE_CAP.findIndex(c => c >= S.up.hire + 1);
  return need != null && need > S.up.os;
}

/* ================= recompute (mirrors recompute + recomputeGear, expected patches) ================= */
function gear(S) {
  const G = { speed: 0, xp: 0, credit: 0, passive: 0, crit: 0, success: 0, coolingRegen: 0, setBonus: 1, stat: Object.fromEntries(STAT_IDS.map(i => [i, 0])) };
  let strong = 0;
  for (const s of SLOTS) {
    if (!S.ilvl[s.id]) continue;
    // Expected patch mix per item: `PATCHES` patches, of which we assume the player has steered
    // 1 to the slot-specific patch (Refactor Tokens exist for exactly this) and the rest to
    // generic +stat patches (tier 0, +1 each) spread evenly across stats.
    const n = Math.min(PATCHES, 4);
    if (n >= 1) {
      const v = SLOT_PATCH_T[s.id][T.patchTier] * T.patchScale;
      ({ ram: () => G.speed += v, cpu: () => G.xp += v, harddrive: () => G.credit += v, monitor: () => G.passive += v,
         gpu: () => G.crit += v, modem: () => G.success += v, cooling: () => G.coolingRegen += v, neural: () => G.success += v })[s.id]();
    }
    for (const id of STAT_IDS) G.stat[id] += Math.max(0, n - 1) * STAT_PATCH_T[T.patchTier] * T.patchScale / STAT_IDS.length;
    if (n >= 3) strong++;
  }
  for (const id of STAT_IDS) G.stat[id] += S.ilvl.neural * 0.05;
  G.coolingRegen += S.ilvl.cooling * 0.01;
  G.setBonus = 1 + Math.floor(strong / 2) * 0.05;
  return G;
}
function mult(S) {
  const G = gear(S), m = MACH[S.up.computer], md = MODEL[S.up.model], I = S.ilvl;
  const vm = (T.modelMult ? T.modelMult[S.up.model] : 1) * (1 + T.skillBonus * (S.unlocked.length - 1));
  return {
    speed: (1 + I.ram * T.ilvlSpeed + G.speed) * m.speed * md.speed * G.setBonus,
    xp: (1 + I.cpu * T.ilvlXp + G.xp) * m.mult * vm * G.setBonus,
    credit: (1 + I.harddrive * T.ilvlCredit + G.credit) * m.mult * vm * G.setBonus,
    passive: I.monitor * T.ilvlPassive * m.mult * (1 + G.passive),
    success: md.success + Math.min(0.10, I.modem * 0.002) + G.success,
    crit: Math.min(0.6, I.gpu * 0.005 + G.crit),
    assist: Math.min(0.75, S.up.assist * 0.05),
    workers: Math.min(8, 1 + S.up.hire),
    G,
  };
}

/* ================= rate(state): expected per-second flows ================= */
function rate(S, kps = KPS) {
  if (S.up.hire === 0) kps = Math.max(kps, 2);   // nothing moves until you type; assume the player types until the first hire
  const M = mult(S);
  const surge = T.surgeIdle + Math.min(9 - T.surgeIdle, kps * 0.9 / 1.4);          // bumpSurge(0.9)/press vs decay (1-surge)*1.4/s
  const agentAdv = (1 + surge * T.surgeAgent) + kps * 0.05;         // elapsed/sec for an auto agent
  const cdAdv = 1 + surge * T.surgeCd;                           // cooldown/sec
  const diff = 5 + S.stage * 1.35 + 2;                     // rand(0,4) → +2
  const focus = S.stats.focus + M.G.stat.focus;
  let cr = 0, xp = 0, plot = 0, succ = 0, statGain = {}, fails = 0;
  const pool = S.unlocked;
  for (const stat of pool) {
    const sv = S.stats[stat] + M.G.stat[stat];
    const speed = (1 + sv / 22 + focus / 60) * M.speed;
    const dur = clamp((5.5 + diff * 0.35) / speed, T.durMin, 16);
    const streakEst = Math.min(0.15, 0.01 * clamp(0.58 + (sv - diff) * 0.045 + M.success, 0.15, 0.98) / (1 - clamp(0.58 + (sv - diff) * 0.045 + M.success, 0.15, 0.98)));
    const chance = clamp(0.58 + (sv - diff) * 0.045 + streakEst + M.success, 0.15, 0.98);
    const critMul = 1 + 2 * M.crit;
    // tasks/sec for one auto agent and for the manual worker on this stat
    const agentTps = 1 / (dur / agentAdv + 0.7 / cdAdv);
    const manualProg = M.assist / dur + 0.09 * kps;          // fraction of task per sec
    const manualTps = manualProg > 0 ? 1 / (1 / manualProg + 0.7 / cdAdv) : 0;
    const tps = ((M.workers - 1) * agentTps + manualTps) / pool.length;
    const s = tps * chance;
    cr += s * (diff * 0.6 + 4) * M.credit * critMul;
    xp += s * (diff + 6) * (1 + S.stage * 0.08) * M.xp * critMul + tps * (1 - chance) * (diff + 6) * 0.2 * M.xp;
    plot += s * (diff * 0.5 + 4);
    succ += s; fails += tps * (1 - chance);
    statGain[stat] = s * 0.7 / (1 + sv * T.statGainDecay);
  }
  return { credits: cr + M.passive, xp: xp + kps, plot: plot + kps * 0.3, succ, fails, statGain, passive: M.passive, M };
}

/* ================= purchases ================= */
function apply(u, S) {   // mutate S as buy() would
  if (u.kind === "unlock") S.up[u.id] = 1;
  else if (u.kind === "skill") { const id = STAT_IDS[S.unlocked.length]; if (T.skillStart) S.stats[id] = Math.max(S.stats[id], T.skillStart * S.unlocked.reduce((a, k) => a + S.stats[k], 0) / S.unlocked.length); S.unlocked.push(id); S.up.skill++; }
  else if (u.kind === "roll") {   // expected value: 1/n chance per unlocked slot of an ilvl≈level item
    const open = SLOTS.filter(s => S.up.os >= s.os);
    const il = Math.min(ILVL_CAP[S.up.os], S.level);
    for (const s of open) S.ilvl[s.id] = S.ilvl[s.id] + Math.max(0, il - S.ilvl[s.id]) / open.length;   // smeared EV
  } else S.up[u.id]++;
}
function options(S) {
  const out = [];
  const base = rate(S).credits;
  for (const u of UPG) {
    const cost = upCost(u, S); if (cost == null || osLock(u, S)) continue;
    const T = clone(S); apply(u, T);
    let d = rate(T).credits - base;
    // OS purchases are enablers: credit their future value by pretending the next hire/slots exist.
    // We just report Δrate honestly (often 0) and flag them; the bot treats OS as a gate to buy when
    // something it wants is locked behind it.
    out.push({ u, cost, d, payback: d > 0 ? cost / d : Infinity, rateAfter: base + d });
  }
  return out;
}

/* ================= greedy playthrough ================= */
function step(S, dt) {
  const R = rate(S);
  S.t += dt; S.credits += R.credits * dt; S.xp += R.xp * dt; S.plot += R.plot * dt;
  for (const id in R.statGain) S.stats[id] += R.statGain[id] * dt;
  // drops: 16%·70% of successes → a random unlocked slot, ilvl≈min(cap, level); equips if empty,
  // and we assume the player equips upgrades from the Toolbox when the drop is better.
  const open = SLOTS.filter(s => S.up.os >= s.os);
  const dropsPerSlot = R.succ * 0.112 * dt / open.length;
  const il = Math.min(ILVL_CAP[S.up.os], S.level);
  for (const s of open) S.ilvl[s.id] += Math.min(1, dropsPerSlot) * Math.max(0, il - S.ilvl[s.id]);
  while (S.xp >= S.xpNeed) {
    S.xp -= S.xpNeed; S.level++; S.xpNeed = Math.round(S.xpNeed * T.xpGrowth + 18);
    const gain = 2 + Math.floor(S.level / 8); S.sp += gain;
  }
  while (S.sp >= 1) {   // auto-allocate to weakest unlocked stat (what autoAlloc does; assume the player does too)
    let lo = S.unlocked[0]; for (const id of S.unlocked) if (S.stats[id] < S.stats[lo]) lo = id;
    S.stats[lo] += 1; S.sp -= 1;
  }
  while (S.plot >= S.plotNeed) { S.plot -= S.plotNeed; S.stage++; S.plotNeed = Math.round(S.plotNeed * 1.16 + 45); S.xp += Math.round(30 * (1 + S.stage * .1)); }
}
const fmtT = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + "h" : "") + String(m).padStart(2, "0") + "m"; };
const money = n => n >= 1e9 ? (n / 1e9).toFixed(2) + "B" : n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : Math.round(n) + "";
const label = (u, S) => u.kind === "tier" ? `${u.id} → ${u.tiers[S.up[u.id] + 1].name}` : u.kind === "skill" ? `skill → ${STAT_IDS[S.unlocked.length]}` : u.kind === "repeat" ? `${u.id} #${S.up[u.id] + 1}` : u.id;

function printTable(S) {
  const R = rate(S);
  console.log(`\n  payback table @ ${fmtT(S.t)}  lvl ${S.level}  stage ${S.stage}  rate ${money(R.credits)}/s  (${money(R.passive)}/s passive)`);
  const rows = options(S).sort((a, b) => a.payback - b.payback);
  for (const o of rows) console.log(`    ${label(o.u, S).padEnd(34)} ${money(o.cost).padStart(8)}  Δ${(o.d >= 0 ? "+" : "") + money(o.d)}/s  payback ${o.payback === Infinity ? "   ∞" : fmtT(o.payback).padStart(7)}  afford ${fmtT(Math.max(0, o.cost - S.credits) / R.credits)}`);
}

function run() {
  const S = initial();
  const log = [], milestones = [];
  let lastOs = 0;
  console.log(`=== greedy playthrough  kps=${KPS}  patches/item=${PATCHES}  ${HOURS}h ===`);
  if (TABLE) printTable(S);
  const dt = 1;
  while (S.t < HOURS * 3600) {
    const R = rate(S);
    // choose target: min over options of (time-to-afford + payback). Unlocks & OS have Δ=0 → ∞,
    // so handle: unlocks bought when cheap (< 60s of income); OS bought when it's the cheapest
    // route to the best locked option, or when cheap (< 5 min of income).
    const opts = options(S);
    let target = null, best = Infinity;
    for (const o of opts) {
      if (o.d <= 0) continue;
      const score = Math.max(0, o.cost - S.credits) / R.credits + o.payback;
      if (score < best) { best = score; target = o; }
    }
    // what's locked behind the next OS? evaluate hire past cap
    const osOpt = opts.find(o => o.u.id === "os");
    if (osOpt) {
      const T = clone(S); T.up.os++;
      const locked = options(T).filter(o => o.d > 0 && !opts.find(p => p.u.id === o.u.id && p.cost === o.cost));
      for (const o of locked) {
        const score = Math.max(0, osOpt.cost + o.cost - S.credits) / R.credits + (osOpt.cost + o.cost) / o.d;
        if (score < best) { best = score; target = osOpt; }
      }
      // OS is the progression spine (new slots, the win condition): take it whenever affordable unless a <5-min-payback buy is also affordable
      if (osOpt.cost <= S.credits && !(target && target.cost <= S.credits && target.payback < 300)) target = osOpt;
    }
    for (const o of opts) if ((o.u.kind === "unlock" || (args.skills && o.u.kind === "skill")) && o.cost < R.credits * 60 && o.cost <= S.credits) { target = o; break; }
    if (target && target.cost <= S.credits) {
      const before = R.credits;
      S.credits -= target.cost; apply(target.u, S);
      const after = rate(S).credits;
      log.push({ t: S.t, what: label(target.u, { ...S, up: { ...S.up, [target.u.id]: S.up[target.u.id] - (target.u.kind === "tier" || target.u.kind === "repeat" ? 1 : 0) }, unlocked: target.u.kind === "skill" ? S.unlocked.slice(0, -1) : S.unlocked }), cost: target.cost, before, after, level: S.level });
      if (target.u.id === "os" || ["computer", "model", "hire"].includes(target.u.id)) milestones.push(log[log.length - 1]);
      if (S.up.os > lastOs) { lastOs = S.up.os; if (TABLE) printTable(S); }
      continue;
    }
    step(S, dt);
  }
  console.log("  OS timeline: " + log.filter(l => l.what.startsWith("os →")).map(l => l.what.slice(5) + " @ " + fmtT(l.t) + " L" + l.level).join("  |  "));
  if (args.brief) { const R0 = rate(S); console.log(`  end: ${fmtT(S.t)} lvl ${S.level} stage ${S.stage} rate ${money(R0.credits)}/s  model tier ${S.up.model}  skills ${S.unlocked.length}`); return; }
  console.log("\n  purchase log (time · item · cost · rate before → after · lvl):");
  const merged = [];
  for (const l of log) { const p = merged[merged.length - 1];
    if (p && p.what === "roll" && l.what === "roll") { p.n++; p.cost += l.cost; p.after = l.after; p.level = l.level; } else merged.push({ ...l, n: 1 }); }
  for (const l of merged) console.log(`    ${fmtT(l.t).padStart(7)}  ${(l.n > 1 ? `roll ×${l.n}` : l.what).padEnd(34)} ${money(l.cost).padStart(8)}   ${money(l.before)}/s → ${money(l.after)}/s   L${l.level}`);
  const R = rate(S);
  console.log(`\n  end: ${fmtT(S.t)}  lvl ${S.level}  stage ${S.stage}  OS ${OS_TIERS[S.up.os].name}  rate ${money(R.credits)}/s  banked ${money(S.credits)}`);
  console.log(`  stats ${STAT_IDS.map(i => i + " " + Math.round(S.stats[i])).join("  ")}   ilvl ${SLOTS.map(s => s.id + " " + Math.round(S.ilvl[s.id])).join(" ")}`);
  console.log(`  success/fail per sec ${R.succ.toFixed(2)}/${R.fails.toFixed(2)}`);
}
if (args.probe) {   // --probe: rate() for the validate-rate.mjs fixture, to compare with the real game
  const F = JSON.parse(process.env.FIX || "{}");
  const S = initial(); S.level = F.level ?? 20; S.stage = F.stage ?? 4; for (const k of STAT_IDS) S.stats[k] = F.stat ?? 20; S.unlocked = STAT_IDS.slice(0, F.nStats ?? 3);
  S.up.hire = F.hire ?? 2; S.up.os = F.os ?? 1; S.up.computer = F.computer ?? 1; S.up.model = F.model ?? 0;
  for (const s of SLOTS) if (s.os <= S.up.os) S.ilvl[s.id] = F.ilvl ?? 0;
  for (const k of [0, 2, 5]) { const R = rate(S, k); console.log(JSON.stringify({ kps: k, creditsPerSec: +R.credits.toFixed(2), xpPerSec: +R.xp.toFixed(2), tasksPerSec: +(R.succ + R.fails).toFixed(2), successRate: +(R.succ / (R.succ + R.fails)).toFixed(2) })); }
} else run();
