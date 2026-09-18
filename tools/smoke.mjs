#!/usr/bin/env node
// Headless-Chrome smoke harness for vibe hacker. The game is one IIFE, so nothing inside it is
// reachable from Runtime.evaluate: we drive real DOM clicks / key events and read state back
// through the game's own save (localStorage "vibehacker").
// Usage: node tools/smoke.mjs <scenario> [--keep]      (see SCENARIOS at the bottom)
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
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
// Starter-kit item factory for fixtures: one ilvl-`il` item per gear slot key, ids 60..63.
export const kit = (k, il = 10) => ({ id: 60 + ["model","memory","compute","tools"].indexOf(k), slot: k, name: "kit " + k, ilvl: il, patches: [], maxPatches: 2 });
// Queue fixture: tier t with n seats, empty sockets, no bounty. `nextBounty` large keeps bounties out of scenarios that don't test them.
export const queue = (tier, seats, extra = {}) => Object.assign({ tier, seats, configs: Array(tier >= 3 ? 3 : 2).fill(null), bounty: null, nextBounty: 1e9 }, extra);
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
  if (!process.argv.includes("--keep")) {
    chrome.kill();
    await new Promise(r => { chrome.once("exit", r); setTimeout(r, 3000); });
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
    catch (e) { console.error("(cleanup) couldn't remove " + dir + ": " + e.message); }
  }
  process.exit(pass ? 0 : 1);
}

/* ===================== scenarios (one per plan task; add below) ===================== */
export const SCENARIOS = {
  async boots() {
    const s = await boot();
    assert(typeof s.ver === "number", "save has no ver");
    assert(s.intro === true, "fresh game should be in intro");
  },
  async stateShape() {
    const s = await boot();
    assert(s.ver === 10, "SAVE_VER must be 10, got " + s.ver);
    assert(Array.isArray(s.agents) && s.agents.length === 1, "fresh save has exactly one agent (you)");
    const a = s.agents[0];
    for (const k of ["model", "memory", "compute", "tools"]) assert(a.gear[k] && a.gear[k].ilvl === 10, "agent zero starter " + k + " ilvl 10");
    assert(Array.isArray(a.inv), "agent has inv"); assert(typeof a.sanity === "number", "agent has sanity"); assert(a.q === 0, "agent seated in queue 0");
    assert(a.rogue === null, "agent zero starts not rogue (a.rogue persisted as null)");
    assert(Array.isArray(s.queues) && s.queues.length === 1 && s.queues[0].tier === 0 && s.queues[0].seats === 1, "one Backlog queue with one seat");
    const q = s.queues[0];
    assert(!("mods" in q), "q.mods (integer) is gone — mods are derived from q.configs");
    assert(Array.isArray(q.configs) && q.configs.length === 2 && q.configs.every(c => c === null), "Backlog has two empty Config sockets");
    assert(q.bounty === null && typeof q.nextBounty === "number", "queue carries bounty/nextBounty");
    assert(s.bountiesDone === 0 && s.bountiesMissed === 0, "bounty counters present");
    assert(s.selectedAgent === 0, "selectedAgent defaults to 0");
    assert(!("m" in a) && !("down" in a) && !("immune" in a), "runtime fields must not be persisted");
    assert(s.rogues === 0 && s.stolen === 0 && !("burnouts" in s), "P.rogues/P.stolen replace P.burnouts");
    assert(s.up.u_queues === 0 && s.up.queue === 0 && s.unlocked.queues === false, "queues unlock/counter fields present");
  },
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
    const qn0 = await ev(`document.querySelector('#manualWrap .agent .qn').textContent`);
    assert(typeof qn0 === "string" && !qn0.includes("Backlog"), "tile stays nameless before the Queues app, got: " + qn0);
    const r = await click('[data-upg="u_queues"] .buy'); assert(r === "ok", "u_queues card present");
    await sleep(3500);
    const s1 = await readSave();
    assert(s1.unlocked.queues === true && s1.up.u_queues === 1, "Queues app unlocked");
    const qn1 = await ev(`document.querySelector('#manualWrap .agent .qn').textContent`);
    assert(qn1.includes("Backlog"), "tile names the Backlog once the Queues app is owned, got: " + qn1);
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
    assert(txt.includes("\u{1F512}"), "Jira needs Win95 \u2192 locked button, got " + txt);
    const boards = await ev(`[...document.querySelectorAll('#queuesBody .qboard')].map(b=>b.dataset.q)`);
    assert(boards.join(",") === "0,1,-1", "boards are Backlog, Kanban, Bench: " + boards);
  },
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
  // Select the hired agent, equip a better Model from its inventory via the Equipment/Inventory apps, see Quality rise.
  async perAgentGear() {
    const s0 = await boot({ fixture: s => { s.intro = false; s.credits = 100; s.reveal = { credits: true, shop: true, store: true };
      s.unlocked.inventory = true; s.unlocked.equipment = true; s.unlocked.ide = true; s.up.u_inv = 1; s.up.u_equip = 1; s.up.u_ide = 1;
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
  // A benched agent (q = -1) works no tickets, regenerates sanity, and is never treated as "on Backlog".
  async bench() {
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
  // Click-to-seat: the picker lists every board with a success readout; choosing Kanban moves the agent and it works Kanban tickets.
  async seatAgent() {
    const s0 = await boot({ fixture: s => { s.intro = false; s.credits = 0; s.earned = 0; s.reveal = { credits: true, shop: true, store: true }; s.up.os = 1; s.up.u_queues = 1; s.unlocked.queues = true;
      s.agents.push({ id: 2, name: "bot", color: "#0ff", gear: Object.fromEntries(["model","memory","compute","tools"].map(k => [k, kit(k, 30)])), inv: [], sanity: 100, q: 0, done: 0, failed: 0, rogue: null });
      s.queues = [queue(0, 2), queue(1, 1)]; }});
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
  // Drag-to-seat: dragging the bot chip past the dead zone onto the Bench board benches it without opening the picker.
  async dragSeat() {
    const s0 = await boot({ fixture: s => { s.intro = false; s.credits = 0; s.earned = 0; s.reveal = { credits: true, shop: true, store: true }; s.up.os = 1; s.up.u_queues = 1; s.unlocked.queues = true;
      s.agents.push({ id: 2, name: "bot", color: "#0ff", gear: Object.fromEntries(["model","memory","compute","tools"].map(k => [k, kit(k, 30)])), inv: [], sanity: 100, q: 0, done: 0, failed: 0, rogue: null });
      s.queues = [queue(0, 2), queue(1, 1)]; }});
    assert(s0.agents[1].q === 0, "bot starts on Backlog");
    const pts = await ev(`(()=>{const z=parseFloat(getComputedStyle(document.documentElement).zoom)||1;
      const c=x=>{const r=x.getBoundingClientRect(); return {x:(r.left+r.width/2)*z, y:(r.top+r.height/2)*z};};
      return {zoom:z, chip:c(document.querySelector('#queuesBody .qchip[data-agent="1"]')), bench:c(document.querySelector('#queuesBody .qboard[data-q="-1"]'))};})()`);
    assert(pts && pts.chip && pts.bench, "chip and Bench board rects readable: " + JSON.stringify(pts));
    const { chip, bench } = pts;
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: chip.x, y: chip.y, button: "left", clickCount: 1 });
    await sleep(50);
    const steps = [[chip.x + 10, chip.y + 10], [chip.x + (bench.x - chip.x) * 0.4, chip.y + (bench.y - chip.y) * 0.4], [chip.x + (bench.x - chip.x) * 0.8, chip.y + (bench.y - chip.y) * 0.8], [bench.x, bench.y]];
    for (const [x, y] of steps) { await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "left" }); await sleep(50); }
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: bench.x, y: bench.y, button: "left", clickCount: 1 });
    await sleep(3500);
    const s1 = await readSave();
    assert(s1.agents[1].q === -1, "bot benched by drag, q = " + s1.agents[1].q);
    assert(await ev(`!!document.querySelector('#queuesBody .qboard[data-q="-1"] .qchip[data-agent="1"]')`), "chip sits on the Bench board");
    assert(await ev(`!document.querySelector('#qpicker')`), "a completed drag must not open the picker");
  },
  // An agent that can't hold its queue goes rogue: it stops working, embezzles credits every second, and Kill -9
  // (priced off its gear) restarts it at half sanity with immunity. Covers the Phase 1 residual burnout → recovery path.
  async rogue() {
    const s0 = await boot({ fixture: s => { s.intro = false; s.credits = 1000; s.earned = 0; s.reveal = { credits: true, shop: true, store: true }; s.up.os = 1; s.up.u_queues = 1; s.unlocked.queues = true;
      // ilvl 10 kit → Quality 20 vs Kanban D25 → 25% success; sanity 5 → the first failure (-23) sends it rogue
      s.agents.push({ id: 2, name: "bot", color: "#0ff", gear: Object.fromEntries(["model","memory","compute","tools"].map(k => [k, kit(k)])), inv: [], sanity: 5, q: 1, done: 0, failed: 0, rogue: null });
      s.queues = [queue(0, 1), queue(1, 1)]; }});
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
    const k9 = 8 * 40;   // BAL.kill9PerIlvl × Σ ilvl of the fixture kit (4 × ilvl 10) — must follow BAL.kill9PerIlvl if it changes
    const k9txt = await ev(`document.querySelector('#queuesBody .qchip[data-agent="1"] .k9').textContent`);
    assert(new RegExp("Kill -9 \\$" + k9 + "\\b").test(k9txt), "Kill -9 priced at $" + k9 + ", got " + k9txt);
    const r = await click('#queuesBody .qchip[data-agent="1"] .k9'); assert(r === "ok", "Kill -9 button");
    await sleep(3500); const s3 = await readSave();
    assert(s3.agents[1].rogue === null, "Kill -9 clears rogue");
    assert(Math.abs(s3.credits - (s2.credits - k9)) < 12, "Kill -9 cost $" + k9 + " within autosave drift (" + s2.credits + " → " + s3.credits + ")");
    assert(s3.agents[1].sanity >= 40, "restarted at ~half sanity (max 90 → 45), got " + s3.agents[1].sanity);
    assert(!("immune" in s3.agents[1]), "immune is not persisted");
    await sleep(10000); const s4 = await readSave();   // still inside the 20 s immunity: failures can't re-rogue it
    assert(s4.agents[1].rogue === null && s4.agents[1].sanity >= 1, "immune agent cannot go rogue again yet");
  },
  // While the tab is closed only seated, sane agents earn; a rogue neither steals nor recovers; the Bench earns nothing.
  async offline() {
    const mk = (id, name, q, extra) => Object.assign({ id, name, color: "#0ff", gear: Object.fromEntries(["model","memory","compute","tools"].map(k => [k, kit(k, 10)])), inv: [], sanity: 100, q, done: 0, failed: 0, rogue: null }, extra);
    const s0 = await boot({ fixture: s => { s.intro = false; s.credits = 1000; s.earned = 0; s.reveal = { credits: true, shop: true, store: true }; s.up.os = 1; s.up.u_queues = 1; s.unlocked.queues = true;
      s.up.offline = 1; s.lastReal = Date.now() - 3600 * 1000;   // an hour away with Cloud Sync
      s.agents.push(mk(2, "worker", 0), mk(3, "thief", 0, { sanity: 0, rogue: { mode: "embezzler", t: 0, stolen: 0 } }), mk(4, "bench", -1));
      s.queues = [queue(0, 3)]; }});
    const gain = s0.earned;   // offline gain is credited at boot, before the fixture's reload-save
    assert(gain > 0, "seated sane agent earned offline");
    // credits = 1000 + offline gain + ≤7 s of live play; the rogue steals live at ~0.26%/s, so allow 3%
    assert(Math.abs((s0.credits - 1000) - s0.earned) < 0.03 * s0.credits + 1, "no offline steal: credits " + s0.credits + " vs earned " + s0.earned);
    assert(s0.agents[2].rogue && s0.agents[2].sanity < 5, "rogue state frozen while away (no offline recovery)");
    assert(s0.stolen < 0.03 * s0.credits + 1, "rogue stole nothing offline");
    assert(s0.agents[3].done === 0, "benched agent did nothing");
    const rate1 = gain / 3600;   // per second, at the game's 50% offline efficiency
    assert(rate1 > 1.5 && rate1 < 4.5, "gain must be ONE ilvl-10 Backlog agent's rate (~$2.9/s at 50%; two agents would be ~$5.8/s), got " + rate1.toFixed(2) + "/s");
  },
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
    // s1 was captured right after socketing, before any juiced tickets clear — use it as the baseline and assert on
    // the DELTA over the 25 s window, so pre-socket plain tickets (~3% of the earlier total) don't dilute the average.
    await sleep(25000); const s2 = await readSave();
    const dDone = s2.agents[1].done - s1.agents[1].done, dEarned = s2.earned - s1.earned;
    assert(dDone >= 2, "bot cleared tickets on the juiced Kanban");
    assert(dEarned / Math.max(1, dDone) > 190, "per-ticket earnings reflect the mods (got " + Math.round(dEarned / Math.max(1, dDone)) + " per ticket)");
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
  // Bounties: a bounty pre-placed on the Backlog is taken by the next free agent, pays its `pay`, bumps P.bountiesDone
  // and (first ever) yields a Config; a bounty whose clock runs out expires unrewarded and counts as missed.
  async bounty() {
    const mk = (id, q) => ({ id, name: "bot" + id, color: "#0ff", gear: Object.fromEntries(["model","memory","compute","tools"].map(k => [k, kit(k, 40)])), inv: [], sanity: 100, q, done: 0, failed: 0, rogue: null });
    const s0 = await boot({ fixture: s => { s.intro = false; s.credits = 0; s.earned = 0; s.reveal = { credits: true, shop: true, store: true }; s.up.os = 1; s.up.u_queues = 1; s.unlocked.queues = true;
      s.up.offline = 1; s.lastReal = Date.now() - 3600 * 1000;   // an hour away with Cloud Sync — bounty clocks must not move offline
      s.agents.push(mk(2, 0));
      s.queues = [queue(0, 2, { bounty: { name: "Hotfix prod before the demo", D: 10, pay: 500, t: 40, ttl: 40, kind: "config" } }),
        queue(1, 1, { bounty: { name: "Rotate the leaked API key", D: 25, pay: 500, t: 20, ttl: 20, kind: "mats" } })]; }});   // Kanban has no seated agent — nobody can clear its bounty
    // an hour offline plus the ~7 s boot round-trip took < 10 s off the Kanban bounty's 20 s clock — it only ticks in the live loop
    assert(s0.queues[1].bounty && s0.queues[1].bounty.t > 10, "bounty restored; clocks tick only in the live loop, not offline (t=" + (s0.queues[1].bounty && s0.queues[1].bounty.t) + ")");
    const pill1 = await ev(`document.querySelector('#queuesBody .qboard[data-q="1"] .qbounty').className`);
    assert(/\bon\b/.test(pill1), "open bounty shows its pill: " + pill1);
    let s1, waited = 0;
    while (waited < 20000) { await sleep(2000); waited += 2000; s1 = await readSave(); if (s1.bountiesDone >= 1) break; }
    assert(s1.bountiesDone === 1, "the bot cleared the Backlog bounty within 20 s (done=" + s1.bountiesDone + ", missed=" + s1.bountiesMissed + ")");
    assert(s1.queues[0].bounty === null, "Backlog bounty cleared off the board");
    assert(s1.earned >= 500, "bounty paid its pay (earned " + s1.earned + ")");
    const cfgs = s1.agents[1].inv.filter(it => it.slot === "config");
    assert(cfgs.length === 1 && cfgs[0].patches.length === 1 && cfgs[0].patches[0].id.startsWith("mod_"), "first bounty ever pays a Config with one mod");
    const pill = await ev(`document.querySelector('#queuesBody .qboard[data-q="0"] .qbounty').className`);
    assert(!/\bon\b/.test(pill), "bounty pill hidden after the clear: " + pill);
    // expiry: the unstaffed Kanban's bounty clock runs out with nobody able to clear it
    let s2, waited2 = 0;
    while (waited2 < 25000) { await sleep(2000); waited2 += 2000; s2 = await readSave(); if (s2.queues[1].bounty === null) break; }
    assert(s2.queues[1].bounty === null, "expired Kanban bounty is removed");
    assert(s2.bountiesMissed === 1 && s2.bountiesDone === 1, "expiry counts as missed, not done (done=" + s2.bountiesDone + ", missed=" + s2.bountiesMissed + ")");
    assert(s2.materials.hotfix === 0 && s2.materials.refactor === 0, "no reward on expiry");
  },
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
};

const name = process.argv[2];
if (!SCENARIOS[name]) { console.log("scenarios: " + Object.keys(SCENARIOS).join(", ")); process.exit(2); }
try { await SCENARIOS[name](); await done(true); } catch (e) { await done(false, e.message); }
