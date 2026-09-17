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
  async stateShape() {
    const s = await boot();
    assert(s.ver === 8, "SAVE_VER must be 8, got " + s.ver);
    assert(Array.isArray(s.agents) && s.agents.length === 1, "fresh save has exactly one agent (you)");
    const a = s.agents[0];
    for (const k of ["model", "memory", "compute", "tools"]) assert(a.gear[k] && a.gear[k].ilvl === 10, "agent zero starter " + k + " ilvl 10");
    assert(Array.isArray(a.inv), "agent has inv"); assert(typeof a.sanity === "number", "agent has sanity"); assert(a.q === 0, "agent seated in queue 0");
    assert(Array.isArray(s.queues) && s.queues.length === 1 && s.queues[0].tier === 0 && s.queues[0].seats === 1, "one Backlog queue with one seat");
    assert(s.selectedAgent === 0, "selectedAgent defaults to 0");
    assert(!("m" in s.agents[0]) && !("down" in s.agents[0]), "runtime fields must not be persisted");
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
  // On MS-DOS (hire cap 1) the Backlog Seat card must be OS-locked: a seat you cannot fill is a credit trap.
  async seatGate() {
    const s0 = await boot({ fixture: s => { s.intro = false; s.credits = 5000; s.maxCredits = 5000; s.reveal = { credits: true, shop: true, store: true }; /* up.os stays 0 = MS-DOS */ }});
    assert(s0.queues[0].seats === 1, "fixture starts with one seat");
    await click('[data-upg="seat"] .buy');
    await sleep(3500);
    const s1 = await readSave();
    assert(s1.queues[0].seats === 1, "seat must not be buyable on MS-DOS (hire cap 1), got seats=" + s1.queues[0].seats);
    const txt = await ev(`document.querySelector('[data-upg="seat"] .buy').textContent`);
    assert(txt.includes("\u{1F512}"), "seat buy button should show a lock, got: " + txt);
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
};

const name = process.argv[2];
if (!SCENARIOS[name]) { console.log("scenarios: " + Object.keys(SCENARIOS).join(", ")); process.exit(2); }
try { await SCENARIOS[name](); await done(true); } catch (e) { await done(false, e.message); }
