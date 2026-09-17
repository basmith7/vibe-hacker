#!/usr/bin/env node
// Agents & Queues economy skeleton — expected-value simulator for the redesign in
// docs/agents-and-queues.md. Nothing here exists in index.html yet; this is where the numbers get
// derived BEFORE Phase 1 code (Status line of the doc).
//
// Model (see doc "Queues", "Item level rules", "Rogue agents"):
//   agent stats  = FLOOR + Σ_slot ilvl × coeff × (1 + CRAFT·craftBonus)      (no levels)
//   success      = clamp(0.5 + (Quality/D − 1)·SUCC_K, 0, 0.95)               (relative gap, no floor)
//   duration     = clamp((4 + 0.30·D) / (1 + Speed/40), 1.1, 16)
//   payout       = PAY·D^PAYK · toolsMult
//   sanity drain = D·c·(0.1 + (1−success)) per ticket; regen = REGEN·Stamina /s
//   rogue        ⇒ agent uptime = min(1, regen/drain) (it cycles rogue/recover) and a credit tax
//   drops        = each success drops an item w.p. DROP at ilvl ~ U[D_t, D_t+1 band], OS-capped
//   configs      = each mod: +MOD_D difficulty, ×MOD_PAY payout, +MOD_ILVL drop band
//   income       = Σ seated agents  uptime · success · payout / (duration + cooldown)  (+ typing for agent zero)
//
// Usage: node tools/aq-sim.mjs [--kps 2] [--craft 1] [--hours 12] [--tune '{...}'] [--table] [--checks]

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) =>
  a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : []).filter(x => x.length));
const KPS = +(args.kps ?? 2), HOURS = +(args.hours ?? 12), CRAFT = +(args.craft ?? 1);
const T = Object.assign({
  FLOOR: 10,
  COEFF: { model: 1.0, memory: 1.0, compute: 1.0, tools: 0.004 },   // tools: credit mult per ilvl
  craftBonus: 0.6,          // fully crafted gear = ilvl × 1.6 effective
  SUCC_K: 1.25,             // success = 0.5 + (Q/D − 1)·SUCC_K → 95% at Q = 1.36·D, 0% at Q = 0.6·D
  PAY: 1.0, PAYK: 1.5,
  DROP: 0.10,               // drop chance per successful ticket
  c: 0.3, REGEN: 0.02, FAIL_MULT: 3,   // drain/ticket = D·c·(0.1 + FAIL_MULT·(1−chance)); regen = REGEN·Stamina /s
  rogueTax: 0.5,            // fraction of that agent's would-be income lost per rogue cycle (incidents)
  MOD_D: 0.12, MOD_PAY: 1.15, MOD_ILVL: 0.12, MOD_MAX: 3,   // per mod: D ×(1+MOD_D·n), payout ×MOD_PAY^n, drop band ×(1+MOD_ILVL·n)
  BAND_TOP: 0.92,           // tier t drops up to BAND_TOP × next tier's D (uncrafted gear alone should NOT reach 95% at t+1)
  surge: 0.15,              // agents speed ×(1 + surge·(surgeLevel)) — small
  cooldown: 0.7,
  TIERS: [                  // D = difficulty band start; drops roll ilvl in [D, nextD]
    { name: "Backlog", D: 10 }, { name: "Kanban", D: 25 }, { name: "Jira", D: 45 },
    { name: "PagerDuty", D: 70 }, { name: "The Roadmap", D: 100 }, { name: "Legacy Monolith", D: 140 },
  ],
  TIER_OS: [0, 1, 2, 3, 4, 5],          // OS tier required to buy each queue
  ILVL_CAP: [30, 55, 85, 125, 175, 9999],
  HIRE_CAP: [1, 2, 4, 6, 8, 10],       // total agents incl. you, per OS
  // ---- cost ladder (to be rederived) ----
  OS_COST: [0, 4000, 40000, 400000, 3000000, 24000000],
  QUEUE_COST: [0, 2000, 20000, 200000, 2000000, 15000000],
  SEAT_BASE: 150, SEAT_GROWTH: 2.2,    // seat n on a queue: base·growth^(n-1) · tierMult
  SEAT_TIER_MULT: 4,
  HIRE_BASE: 150, HIRE_GROWTH: 3.2,     // hire #n
  STARTER_ILVL: 10,
}, args.tune ? JSON.parse(args.tune) : {});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SLOTS = ["model", "memory", "compute", "tools"];
const succChance = (Q, D) => clamp(0.5 + (Q / D - 1) * T.SUCC_K, 0, 0.95);

/* ================= state ================= */
function initial() {
  return { t: 0, credits: 0, os: 0,
    queues: [{ tier: 0, seats: 1, mods: 0 }],
    agents: [newAgent(T.STARTER_ILVL, 0)],   // agent zero = you, seated in queue 0
    hires: 1 };
}
function newAgent(ilvl, q) { return { gear: Object.fromEntries(SLOTS.map(s => [s, ilvl])), q }; }
const clone = s => JSON.parse(JSON.stringify(s));

/* ================= agent math ================= */
function stats(a) {
  const eff = s => a.gear[s] * T.COEFF[s] * (1 + CRAFT * T.craftBonus);
  return { quality: T.FLOOR + eff("model"), stamina: T.FLOOR + eff("memory"), speed: T.FLOOR + eff("compute"), tools: 1 + eff("tools") };
}

function queueD(q) { return T.TIERS[q.tier].D * (1 + q.mods * T.MOD_D); }
function queuePay(q) { return Math.pow(T.MOD_PAY, q.mods); }
function agentRate(a, q, kps, isZero) {
  const S = stats(a), D = queueD(q);
  const chance = succChance(S.quality, D);
  const surgeLvl = Math.min(8, kps * 0.9 / 1.4);
  const dur = clamp((4 + 0.30 * D) / (1 + S.speed / 40), 1.1, 16) / (1 + T.surge * surgeLvl);
  let tps;
  if (isZero) { const prog = 0.09 * kps; tps = prog > 0 ? 1 / (1 / prog + T.cooldown) : 0; }   // you only move when typing
  else tps = 1 / (dur + T.cooldown);
  const payout = T.PAY * Math.pow(D, T.PAYK) * queuePay(q) * S.tools;
  const drainPerTicket = D * T.c * (0.1 + T.FAIL_MULT * (1 - chance));
  const drain = tps * drainPerTicket, regen = T.REGEN * S.stamina;
  const uptime = drain <= regen ? 1 : (regen / drain) * (1 - T.rogueTax) ;   // cycling rogue costs incidents too
  const succ = tps * chance * uptime;
  return { chance, dur, tps, uptime, credits: succ * payout, succ, D, drain, regen };
}
function rate(S, kps = KPS) {
  if (S.agents.length === 1) kps = Math.max(kps, 2);   // nothing moves until you type; assume typing until the first hire
  let cr = 0, succByQ = S.queues.map(() => 0);
  S.agents.forEach((a, i) => { const q = S.queues[a.q]; const r = agentRate(a, q, kps, i === 0); cr += r.credits; succByQ[a.q] += r.succ; });
  return { credits: cr, succByQ };
}

/* ================= drops / gear progression (expected) ================= */
function bandTop(S, q) { const t = q.tier; return Math.min(T.ILVL_CAP[S.os], T.BAND_TOP * (T.TIERS[t + 1] ? T.TIERS[t + 1].D : T.TIERS[t].D * 1.4) * (1 + q.mods * T.MOD_ILVL)); }
function stepGear(S, dt, kps) {
  // each seated agent: expected drops per sec = succ·DROP; a drop is a random slot with ilvl ~U[D, top].
  // Expected best-of-n keeps its equipped ilvl converging toward `top`; model as exponential approach.
  S.agents.forEach((a, i) => { const q = S.queues[a.q]; const r = agentRate(a, q, kps, i === 0);
    const drops = r.succ * T.DROP * dt / SLOTS.length, top = bandTop(S, q), lo = T.TIERS[q.tier].D;
    for (const s of SLOTS) { if (a.gear[s] >= top) continue;
      // P(drop beats current) · E[improvement | beats]
      const cur = Math.max(a.gear[s], lo), pBeat = (top - cur) / Math.max(1, top - lo), gain = (top - cur) / 2;
      a.gear[s] += Math.min(1, drops) * pBeat * gain; }
  });
}

/* ================= purchases ================= */
function options(S) {
  const out = [], base = rate(S).credits;
  const push = (id, cost, mut) => { const N = clone(S); mut(N); optimiseSeating(N, KPS); const d = rate(N).credits - base; out.push({ id, cost, d, payback: d > 0 ? cost / d : Infinity, mut }); };
  // OS
  if (T.OS_COST[S.os + 1] != null) push("os → " + (S.os + 1), T.OS_COST[S.os + 1], N => N.os++);
  // hire: needs a free seat somewhere and OS cap
  const seatsFree = q => q.seats - S.agents.filter(a => a.q === S.queues.indexOf(q)).length;
  const hireCost = Math.round(T.HIRE_BASE * Math.pow(T.HIRE_GROWTH, S.hires - 1));
  const seatCost = q => Math.round(T.SEAT_BASE * Math.pow(T.SEAT_GROWTH, q.seats - 1) * Math.pow(T.SEAT_TIER_MULT, q.tier));
  if (S.hires < T.HIRE_CAP[S.os]) {
    if (S.queues.some(q => seatsFree(q) > 0))
      push("hire #" + S.hires, hireCost, N => { N.hires++; const qi = N.queues.findIndex((q, i) => q.seats > N.agents.filter(a => a.q === i).length); N.agents.push(newAgent(T.STARTER_ILVL, qi)); });
    else   // no free seat: bundle a seat on the cheapest queue with the hire
      S.queues.forEach((q, qi) => push(`hire #${S.hires} + seat on ${T.TIERS[q.tier].name}`, hireCost + seatCost(q), N => { N.hires++; N.queues[qi].seats++; N.agents.push(newAgent(T.STARTER_ILVL, qi)); }));
  }
  // seats
  S.queues.forEach((q, qi) => { const n = q.seats; push(`seat ${n + 1} on ${T.TIERS[q.tier].name}`, seatCost(q), N => N.queues[qi].seats++); });
  // new queue (next tier, OS-gated)
  const nextTier = S.queues.length; if (T.TIERS[nextTier] && T.TIER_OS[nextTier] <= S.os) push("queue → " + T.TIERS[nextTier].name, T.QUEUE_COST[nextTier], N => N.queues.push({ tier: nextTier, seats: 1, mods: 0 }));
  return out;
}
// free actions the player takes continuously: reseat agents to their best queue, add mods when safe
function optimiseSeating(S, kps) {
  // greedy: for each agent (best-geared first), pick the queue with a free seat maximising its rate
  // an agent values a queue at the mod level it could safely run there (≥90% success), not the current one
  const safeMods = (a, q) => { let m = 0; for (let k = 1; k <= T.MOD_MAX; k++) if (agentRate(a, { ...q, mods: k }, kps, false).chance >= 0.9) m = k; return m; };
  const order = S.agents.map((a, i) => i).sort((x, y) => stats(S.agents[y]).quality - stats(S.agents[x]).quality);
  const used = S.queues.map(() => 0);
  for (const i of order) { let best = -1, br = -1;
    S.queues.forEach((q, qi) => { if (used[qi] >= q.seats) return; const r = agentRate(S.agents[i], { ...q, mods: safeMods(S.agents[i], q) }, kps, i === 0).credits + (i === 0 && kps === 0 ? (S.queues.length - qi) * 1e-6 : 0); if (r > br) { br = r; best = qi; } });
    if (best < 0) best = S.agents[i].q; S.agents[i].q = best; used[best]++; }
  // mods per queue = the most every seated agent can run at ≥90% (Configs are re-socketable)
  S.queues.forEach((q, qi) => { const seated = S.agents.filter(a => a.q === qi); if (!seated.length) return; q.mods = Math.min(...seated.map(a => safeMods(a, q))); });
}

/* ================= playthrough ================= */
const fmtT = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + "h" : "") + String(m).padStart(2, "0") + "m"; };
const money = n => n >= 1e9 ? (n / 1e9).toFixed(2) + "B" : n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : (Math.round(n * 10) / 10) + "";
function printTable(S) {
  const R = rate(S);
  console.log(`\n  payback @ ${fmtT(S.t)}  OS${S.os}  rate ${money(R.credits)}/s  agents ${S.agents.length}  queues ${S.queues.map(q => T.TIERS[q.tier].name + "[" + q.seats + "s," + q.mods + "m]").join(" ")}`);
  for (const o of options(S).sort((a, b) => a.payback - b.payback)) console.log(`    ${o.id.padEnd(28)} ${money(o.cost).padStart(8)}  Δ${money(o.d)}/s  payback ${o.payback === Infinity ? "   ∞" : fmtT(o.payback).padStart(7)}  afford ${fmtT(Math.max(0, o.cost - S.credits) / Math.max(1e-9, R.credits))}`);
  console.log("    agents: " + S.agents.map((a, i) => { const s = stats(a); const r = agentRate(a, S.queues[a.q], KPS, i === 0); return `${i === 0 ? "you" : "#" + i}@${T.TIERS[S.queues[a.q].tier].name} Q${Math.round(s.quality)} ${Math.round(r.chance * 100)}% up${Math.round(r.uptime * 100)}%`; }).join(" | "));
}
function run() {
  const S = initial(); const log = [];
  console.log(`=== A&Q playthrough  kps=${KPS}  craft=${CRAFT}  ${HOURS}h ===`);
  if (args.table) printTable(S);
  let lastOs = 0, dt = 2;
  while (S.t < HOURS * 3600) {
    optimiseSeating(S, KPS);
    const R = rate(S); const opts = options(S);
    let target = null, best = Infinity;
    for (const o of opts) { if (o.d <= 0) continue; const score = Math.max(0, o.cost - S.credits) / Math.max(1e-9, R.credits) + o.payback; if (score < best) { best = score; target = o; } }
    const osOpt = opts.find(o => o.id.startsWith("os"));
    if (osOpt) { // OS unlocks hires/queues: value it by what it unlocks
      const N = clone(S); N.os++; const unlocked = options(N).filter(o => o.d > 0 && !opts.find(p => p.id === o.id));
      for (const o of unlocked) { const score = Math.max(0, osOpt.cost + o.cost - S.credits) / Math.max(1e-9, R.credits) + (osOpt.cost + o.cost) / o.d; if (score < best) { best = score; target = osOpt; } }
      if (osOpt.cost <= S.credits && !(target && target !== osOpt && target.cost <= S.credits && target.payback < 300)) target = osOpt;
    }
    if (target && target.cost <= S.credits) { S.credits -= target.cost; target.mut(S); log.push({ t: S.t, id: target.id, cost: target.cost, before: R.credits, after: rate(S).credits });
      if (S.os > lastOs) { lastOs = S.os; if (args.table) printTable(S); } continue; }
    S.credits += R.credits * dt; stepGear(S, dt, KPS); S.t += dt;
  }
  console.log("  OS timeline: " + log.filter(l => l.id.startsWith("os")).map(l => l.id.slice(5) + " @ " + fmtT(l.t)).join("  |  "));
  console.log("  queues: " + log.filter(l => l.id.startsWith("queue")).map(l => l.id.slice(8) + " @ " + fmtT(l.t)).join("  |  "));
  if (!args.brief) { console.log("\n  purchases:"); for (const l of log) console.log(`    ${fmtT(l.t).padStart(7)}  ${l.id.padEnd(28)} ${money(l.cost).padStart(8)}   ${money(l.before)}/s → ${money(l.after)}/s`); }
  const R = rate(S);
  console.log(`  end: ${fmtT(S.t)}  OS${S.os}  rate ${money(R.credits)}/s  banked ${money(S.credits)}  agents ${S.agents.length}  queues ${S.queues.map(q => T.TIERS[q.tier].name + "[" + q.seats + "s," + q.mods + "m]").join(" ")}`);
  return log;
}

/* ================= design-rule checks ================= */
function checks() {
  console.log("=== design-rule checks ===");
  // Gear-wall: an agent fully geared at tier t's band top (OS = tier's OS) must hit ≥0.9 on tier t+1
  console.log("  gear-wall (band-top gear at tier t → success at t+1):");
  for (let t = 0; t + 1 < T.TIERS.length; t++) { const os = T.TIER_OS[t]; const top = Math.min(T.ILVL_CAP[os], T.BAND_TOP * T.TIERS[t + 1].D);
    for (const craft of [0, 1]) { const a = newAgent(top, 0); const sv = T.FLOOR + top * T.COEFF.model * (1 + craft * T.craftBonus); const D = T.TIERS[t + 1].D;
      const ch = succChance(sv, D); console.log(`    ${T.TIERS[t].name.padEnd(14)} top ilvl ${Math.round(top)} craft=${craft} → Q${Math.round(sv)} vs ${T.TIERS[t + 1].name} D${D}: ${Math.round(ch * 100)}% ${ch >= 0.9 ? "ok" : (ch >= 0.6 ? "meh" : "WALL")}`); } }
  // Interior optimum: for gear levels across the range, which tier maximises income incl. rogue?
  console.log("  best tier per gear level (income incl. rogue uptime); ✓ if best has ≥85% success:");
  for (const il of [10, 20, 30, 45, 60, 80, 110, 150]) { const a = newAgent(il, 0); let best = null;
    const rows = T.TIERS.map((tier, ti) => { const r = agentRate(a, { tier: ti, seats: 1, mods: 0 }, 0, false); if (!best || r.credits > best.r.credits) best = { ti, r }; return `${tier.name.slice(0, 6)} ${Math.round(r.chance * 100)}%/${money(r.credits)}`; });
    console.log(`    ilvl ${String(il).padStart(3)}: best=${T.TIERS[best.ti].name} (${Math.round(best.r.chance * 100)}%, up ${Math.round(best.r.uptime * 100)}%) ${best.r.chance >= 0.85 ? "✓" : "✗ overreach pays"}   [${rows.join(" | ")}]`); }
}

if (args.checks) checks(); else run();
