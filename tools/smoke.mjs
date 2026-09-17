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
  },
};

const name = process.argv[2];
if (!SCENARIOS[name]) { console.log("scenarios: " + Object.keys(SCENARIOS).join(", ")); process.exit(2); }
try { await SCENARIOS[name](); await done(true); } catch (e) { await done(false, e.message); }
