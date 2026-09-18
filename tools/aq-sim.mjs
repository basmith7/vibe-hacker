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
//   configs      = socketed Config patches, one lever each: d (D×), pay (payout×), band (drop band×), speed (dur÷), mats
//   bounties     = a bounty REPLACES one ordinary ticket, so the extra income per staffed queue is
//                  mean(chance) × (BOUNTY_PAY − 1) × payout / BOUNTY_EVERY  (a throughput bonus, 10–20% of income)
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
  // Rogue (Phase 2, Embezzler): while rogue an agent steals ROGUE_STEAL × bank per second and regens
  // sanity at ROGUE_REGEN × normal until 50% of sanityMax. Kill -9 costs KILL9_PER_ILVL × Σ gear ilvl
  // and restarts the agent at half sanity with ROGUE_IMMUNE s of immunity. See doc §3/§4.
  ROGUE_STEAL: 0.00265, ROGUE_REGEN: 0.5, KILL9_PER_ILVL: 8, ROGUE_IMMUNE: 20,
  SANITY_BASE: 50, SANITY_PER_STAMINA: 2,   // sanityMax = SANITY_BASE + SANITY_PER_STAMINA × Stamina (mirrors BAL)
  // Configs (Phase 3): a queue's socketed Configs carry patches ("mods"), each of which moves ONE lever by its
  // rolled value v: d → D ×(1+Σv), pay → payout ×(1+Σv), band → drop band ×(1+Σv), speed → duration ÷(1+Σv),
  // mats → material chance ×(1+Σv). MOD_TIERS are the T1/T2/T3 values (mirrors PATCH_DEFS tiers in the game).
  MOD_TIERS: [0.10, 0.16, 0.24], CONFIG_SLOTS: [2, 2, 2, 3, 3, 3], MAX_PATCHES: 4,
  // Bounties: each staffed queue spawns one every BOUNTY_EVERY s (±30%), paying BOUNTY_PAY × a ticket's payout if an
  // agent clears it within BOUNTY_TTL × (reference duration + cooldown). Reward kind weights mats/gear/config, with
  // BOUNTY_TIER_SHIFT points per tier moved from mats to gear+config (half each).
  BOUNTY_EVERY: 90, BOUNTY_PAY: 3.5, BOUNTY_TTL: 4, BOUNTY_REWARDS: { mats: 60, gear: 30, config: 10 }, BOUNTY_TIER_SHIFT: 4,
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
const LEVERS = ["d", "pay", "band", "speed", "mats"];
const noMods = () => ({ d: 0, pay: 0, band: 0, speed: 0, mats: 0 });
const succChance = (Q, D) => clamp(0.5 + (Q / D - 1) * T.SUCC_K, 0, 0.95);

/* ================= state ================= */
function initial() {
  return { t: 0, credits: 0, os: 0,
    queues: [{ tier: 0, seats: 1, mods: noMods() }],
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

function queueD(q) { return T.TIERS[q.tier].D * (1 + q.mods.d); }
function queuePay(q) { return 1 + q.mods.pay; }
function agentRate(a, q, kps, isZero) {
  const S = stats(a), D = queueD(q);
  const chance = succChance(S.quality, D);
  const surgeLvl = Math.min(8, kps * 0.9 / 1.4);
  const dur = clamp((4 + 0.30 * D) / (1 + S.speed / 40), 1.1, 16) / (1 + T.surge * surgeLvl) / (1 + q.mods.speed);
  let tps;
  if (isZero) { const prog = 0.09 * kps; tps = prog > 0 ? 1 / (1 / prog + T.cooldown) : 0; }   // you only move when typing
  else tps = 1 / (dur + T.cooldown);
  const payout = T.PAY * Math.pow(D, T.PAYK) * queuePay(q) * S.tools;
  const drainPerTicket = D * T.c * (0.1 + T.FAIL_MULT * (1 - chance));
  const drain = tps * drainPerTicket, regen = T.REGEN * S.stamina;
  // Overreach (drain > regen): the agent burns from half sanity to zero, is instantly Kill -9'd back
  // to half, and repeats — full uptime, but every cycle costs kill9Cost. Income = gross − kill9/cycle.
  const sanityMax = T.SANITY_BASE + T.SANITY_PER_STAMINA * S.stamina;
  const kill9 = T.KILL9_PER_ILVL * SLOTS.reduce((s, k) => s + a.gear[k], 0);
  const cycle = drain <= regen ? Infinity : (0.5 * sanityMax) / (drain - regen);
  const uptime = 1, killCost = cycle === Infinity ? 0 : kill9 / cycle;
  const succ = tps * chance;
  return { chance, dur, tps, uptime, credits: Math.max(0, succ * payout - killCost), succ, D, drain, regen, cycle, kill9, payout };
}
function rate(S, kps = KPS, solo = true) {
  // nothing moves until you type; assume typing until the first hire (accrual only — purchase deltas pass solo=false,
  // otherwise at kps 0 the first hire is measured against your typing income and can look like Δ≈0, stalling the bot)
  if (solo && S.agents.length === 1) kps = Math.max(kps, 2);
  let cr = 0, bounty = 0, succByQ = S.queues.map(() => 0);
  const seatedRates = S.queues.map(() => []);
  S.agents.forEach((a, i) => { if (a.q < 0) return; const q = S.queues[a.q]; const r = agentRate(a, q, kps, i === 0); cr += r.credits; succByQ[a.q] += r.succ; if (r.tps > 0) seatedRates[a.q].push(r); });
  // Bounties: one per BOUNTY_EVERY s on every staffed board, taken by whichever seated agent frees up first —
  // so its clear chance is the mean over the board's working agents. It REPLACES one ordinary ticket (the
  // agent that takes it isn't also clearing a normal one), so the extra income is (BOUNTY_PAY − 1) tickets' worth.
  S.queues.forEach((q, qi) => { const rs = seatedRates[qi]; if (!rs.length) return;
    const chance = rs.reduce((s, r) => s + r.chance, 0) / rs.length, payout = rs[0].payout;
    bounty += chance * (T.BOUNTY_PAY - 1) * payout / T.BOUNTY_EVERY; });
  return { credits: cr + bounty, tickets: cr, bounty, succByQ };
}

/* ================= drops / gear progression (expected) ================= */
function bandTop(S, q) { const t = q.tier; return Math.min(T.ILVL_CAP[S.os], T.BAND_TOP * (T.TIERS[t + 1] ? T.TIERS[t + 1].D : T.TIERS[t].D * 1.4) * (1 + q.mods.band)); }
function stepGear(S, dt, kps) {
  // each seated agent: expected drops per sec = succ·DROP; a drop is a random slot with ilvl ~U[D, top].
  // Expected best-of-n keeps its equipped ilvl converging toward `top`; model as exponential approach.
  S.agents.forEach((a, i) => { if (a.q < 0) return; const q = S.queues[a.q]; const r = agentRate(a, q, kps, i === 0);
    const drops = r.succ * T.DROP * dt / SLOTS.length, top = bandTop(S, q), lo = T.TIERS[q.tier].D;
    for (const s of SLOTS) { if (a.gear[s] >= top) continue;
      // P(drop beats current) · E[improvement | beats]
      const cur = Math.max(a.gear[s], lo), pBeat = (top - cur) / Math.max(1, top - lo), gain = (top - cur) / 2;
      a.gear[s] += Math.min(1, drops) * pBeat * gain; }
  });
}

/* ================= purchases ================= */
function options(S) {
  const out = [], base = rate(S, KPS, false).credits;
  const push = (id, cost, mut) => { const N = clone(S); mut(N); optimiseSeating(N, KPS); const d = rate(N, KPS, false).credits - base; out.push({ id, cost, d, payback: d > 0 ? cost / d : Infinity, mut }); };
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
  const nextTier = S.queues.length; if (T.TIERS[nextTier] && T.TIER_OS[nextTier] <= S.os) push("queue → " + T.TIERS[nextTier].name, T.QUEUE_COST[nextTier], N => N.queues.push({ tier: nextTier, seats: 1, mods: noMods() }));
  return out;
}
// free actions the player takes continuously: reseat agents to their best queue, add mods when safe
function optimiseSeating(S, kps) {
  // greedy: for each agent (best-geared first), pick the queue with a free seat maximising its rate
  // an agent values a queue at the mod level it could safely run there (≥90% success), not the current one
  // Configs: each queue has CONFIG_SLOTS × MAX_PATCHES patch slots, CRAFT of which the player has filled (at T2 value).
  // The bot spends them on Legacy Codebase (d) while the weakest seated agent still clears ≥90%, and the rest on
  // Enterprise Client (pay) — surplus Quality becomes difficulty (and D^1.5 payout), the remainder flat payout.
  const budget = q => Math.round(T.CONFIG_SLOTS[q.tier] * T.MAX_PATCHES * CRAFT), V = T.MOD_TIERS[1];
  const safeD = (a, q) => { let n = 0; for (let k = 1; k <= budget(q); k++) if (agentRate(a, { ...q, mods: { ...noMods(), d: k * V } }, kps, false).chance >= 0.9) n = k; return n; };
  const modsFor = (a, q) => { const nd = safeD(a, q); return { ...noMods(), d: nd * V, pay: (budget(q) - nd) * V }; };
  const order = S.agents.map((a, i) => i).sort((x, y) => stats(S.agents[y]).quality - stats(S.agents[x]).quality);
  const used = S.queues.map(() => 0);
  for (const i of order) { let best = -1, br = -1;
    S.queues.forEach((q, qi) => { if (used[qi] >= q.seats) return; const r = agentRate(S.agents[i], { ...q, mods: modsFor(S.agents[i], q) }, kps, i === 0).credits + (i === 0 && kps === 0 ? (S.queues.length - qi) * 1e-6 : 0); if (r > br) { br = r; best = qi; } });
    S.agents[i].q = best; if (best >= 0) used[best]++; }   // best < 0 = no free seat anywhere → Bench
  // mods per queue = the weakest seated agent's plan (Configs are re-socketable)
  S.queues.forEach((q, qi) => { const seated = S.agents.filter(a => a.q === qi); if (!seated.length) return;
    const nd = Math.min(...seated.map(a => safeD(a, q))); q.mods = { ...noMods(), d: nd * V, pay: (budget(q) - nd) * V }; });
}

/* ================= playthrough ================= */
const fmtT = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + "h" : "") + String(m).padStart(2, "0") + "m"; };
const modLabel = q => LEVERS.filter(k => q.mods[k] > 0).map(k => k + Math.round(q.mods[k] * 100)).join("/") || "0m";
const money = n => n >= 1e9 ? (n / 1e9).toFixed(2) + "B" : n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : (Math.round(n * 10) / 10) + "";
function printTable(S) {
  const R = rate(S);
  console.log(`\n  payback @ ${fmtT(S.t)}  OS${S.os}  rate ${money(R.credits)}/s  agents ${S.agents.length}  queues ${S.queues.map(q => T.TIERS[q.tier].name + "[" + q.seats + "s," + modLabel(q) + "]").join(" ")}`);
  for (const o of options(S).sort((a, b) => a.payback - b.payback)) console.log(`    ${o.id.padEnd(28)} ${money(o.cost).padStart(8)}  Δ${money(o.d)}/s  payback ${o.payback === Infinity ? "   ∞" : fmtT(o.payback).padStart(7)}  afford ${fmtT(Math.max(0, o.cost - S.credits) / Math.max(1e-9, R.credits))}`);
  console.log("    agents: " + S.agents.map((a, i) => { const s = stats(a); const r = agentRate(a, S.queues[Math.max(0, a.q)], KPS, i === 0); return `${i === 0 ? "you" : "#" + i}@${(a.q < 0 ? "Bench" : T.TIERS[S.queues[a.q].tier].name)} Q${Math.round(s.quality)} ${Math.round(r.chance * 100)}% up${Math.round(r.uptime * 100)}%`; }).join(" | "));
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
  console.log(`  end: ${fmtT(S.t)}  OS${S.os}  rate ${money(R.credits)}/s  banked ${money(S.credits)}  agents ${S.agents.length}  queues ${S.queues.map(q => T.TIERS[q.tier].name + "[" + q.seats + "s," + modLabel(q) + "]").join(" ")}`);
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
  // Interior optimum: for gear levels across the range, which tier maximises income (net of Kill -9 per cycle)?
  console.log("  best tier per gear level (income net of Kill -9 per cycle); ✓ if best has ≥85% success:");
  for (const il of [10, 20, 30, 45, 60, 80, 110, 150]) { const a = newAgent(il, 0); let best = null;
    const rows = T.TIERS.map((tier, ti) => { const r = agentRate(a, { tier: ti, seats: 1, mods: noMods() }, 0, false); if (!best || r.credits > best.r.credits) best = { ti, r }; return `${tier.name.slice(0, 6)} ${Math.round(r.chance * 100)}%/${money(r.credits)}`; });
    console.log(`    ilvl ${String(il).padStart(3)}: best=${T.TIERS[best.ti].name} (${Math.round(best.r.chance * 100)}%, up ${Math.round(best.r.uptime * 100)}%) ${best.r.chance >= 0.85 ? "✓" : "✗ overreach pays"}   [${rows.join(" | ")}]`); }
  // Kill -9 breakeven: a full unattended rogue (0 → 50% sanity at ROGUE_REGEN × regen) must lose ≥ 25% of the
  // bank at every Stamina, so at bank = 4 × kill9Cost paying beats waiting. ROGUE_STEAL is calibrated at endgame
  // Stamina (highest ilvl cap); lower Stamina recovers slower and therefore loses more — that's intended.
  console.log("  Kill -9 breakeven (loss of bank over a full unattended rogue; need ≥ 25% everywhere):");
  for (const il of [10, 20, 30, 45, 60, 80, 110, 150, 175]) { const a = newAgent(il, 0); const S = stats(a);
    const sanityMax = T.SANITY_BASE + T.SANITY_PER_STAMINA * S.stamina, regen = T.REGEN * S.stamina * T.ROGUE_REGEN;
    const Trec = 0.5 * sanityMax / regen, loss = 1 - Math.exp(-T.ROGUE_STEAL * Trec), kill9 = T.KILL9_PER_ILVL * il * SLOTS.length;
    console.log(`    ilvl ${String(il).padStart(3)}: recover ${Math.round(Trec)}s  loss ${Math.round(loss * 100)}%  kill9 ${money(kill9)} (= ${Math.round(kill9 / Math.max(1e-9, agentRate(a, { tier: 0, seats: 1, mods: noMods() }, 0, false).credits))}s of Backlog income) ${loss >= 0.25 ? "✓" : "✗ waiting beats Kill -9"}`); }
  // Overreach with instant Kill -9: the best tier per gear level (income net of kill9/cycle) must still be a ≥85% one.
  console.log("  overreach with instant Kill -9 (net of kill9 per cycle); ✓ if best tier has ≥85% success:");
  for (const il of [10, 20, 30, 45, 60, 80, 110, 150]) { const a = newAgent(il, 0); let best = null;
    T.TIERS.forEach((tier, ti) => { const r = agentRate(a, { tier: ti, seats: 1, mods: noMods() }, 0, false); if (!best || r.credits > best.r.credits) best = { ti, r }; });
    console.log(`    ilvl ${String(il).padStart(3)}: best=${T.TIERS[best.ti].name} ${Math.round(best.r.chance * 100)}% cycle ${best.r.cycle === Infinity ? "∞" : Math.round(best.r.cycle) + "s"} ${best.r.chance >= 0.85 ? "✓" : "✗ overreach pays"}`); }
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
}

if (args.probe) {   // same fixture as tools/validate-rate.mjs: N agents (agent zero idle) with uniform ilvl gear; FIX.queues/FIX.seat place them (−1 = Bench); FIX.mods = per-queue {d,pay,band,speed,mats} lever sums
  const F = JSON.parse(process.env.FIX || "{}"); const n = F.agents ?? 3, il = F.ilvl ?? 10;
  const queues = F.queues ?? [{ tier: 0, seats: n }], seat = F.seat ?? Array(n).fill(0);
  const mods = F.mods ?? queues.map(() => ({}));
  const S = initial(); S.os = Math.max(...queues.map(q => q.tier)); S.queues = queues.map((q, i) => ({ tier: q.tier, seats: q.seats, mods: { ...noMods(), ...mods[i] } }));
  S.agents = Array.from({ length: n }, (_, i) => newAgent(il, seat[i])); S.hires = n;
  for (const k of [0, 2]) { let cr = 0, succ = 0, tot = 0; S.agents.forEach((a, i) => { if (a.q < 0) return; const r = agentRate(a, S.queues[a.q], k, i === 0); cr += r.credits; succ += r.succ; tot += r.tps * r.uptime; });
    console.log(JSON.stringify({ kps: k, creditsPerSec: +cr.toFixed(2), tasksPerSec: +tot.toFixed(2), successRate: +(succ / Math.max(1e-9, tot)).toFixed(2) })); }
} else if (args.checks) checks(); else run();
