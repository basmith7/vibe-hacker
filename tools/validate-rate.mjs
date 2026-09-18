// Throwaway: measure real credits/sec + xp/sec in headless Chrome for a fixed state and
// compare with tools/aq-sim.mjs's --probe. Usage: node tools/validate-rate.mjs [kps] [secs]
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const KPS = +(process.argv[2] ?? 0), SECS = +(process.argv[3] ?? 60);
const PORT = 9333 + Math.floor(Math.random() * 500);
const dir = mkdtempSync(path.join(tmpdir(), "vh-"));
const url = "file://" + path.resolve("index.html");
const chrome = spawn("google-chrome", ["--headless=new", "--disable-gpu", "--no-sandbox", `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, "--window-size=1920,1080", url], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0, pend = new Map();
async function connect() {
  for (let i = 0; i < 50; i++) { try { const j = await (await fetch(`http://localhost:${PORT}/json`)).json(); const p = j.find(x => x.type === "page"); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch { } await sleep(200); }
  await new Promise(r => ws.onopen = r);
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } else if (m.method === "Runtime.exceptionThrown") console.error("EXC", JSON.stringify(m.params.exceptionDetails.exception?.description)); };
}
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) console.error("EVAL ERR", r.exceptionDetails.text, r.exceptionDetails.exception?.description); return r.result?.value; };

await connect();
await send("Runtime.enable"); await send("Page.enable");
await sleep(6000);
// take the game's own fresh save and mutate it into the fixture
let raw = await ev(`localStorage.getItem("vibehacker")`); if (!raw) { await sleep(4000); raw = await ev(`localStorage.getItem("vibehacker")`); }
if (!raw) { console.error("no save yet; cookie=", await ev(`document.cookie`)); chrome.kill(); process.exit(1); }
const fixture = JSON.parse(raw);
const F = JSON.parse(process.env.FIX || "{}");   // {agents, ilvl, queues?, seat?}
const nAgents = F.agents ?? 3, ilvl = F.ilvl ?? 10;
// Optional: F.queues = [{tier, seats}], F.seat = [q per agent] (−1 = Bench). Default: everyone on one Backlog.
const queues = F.queues ?? [{ tier: 0, seats: nAgents }], seat = F.seat ?? Array(nAgents).fill(0);
const SLOTS = ["model", "memory", "compute", "tools"]; let seq = 100;
const kit = () => Object.fromEntries(SLOTS.map(k => [k, { id: ++seq, slot: k, name: "fixture " + k, ilvl, patches: [], maxPatches: 2 }]));
Object.assign(fixture, { intro: false, credits: 0, earned: 0, tasksDone: 0, tasksFailed: 0, xp: 0, xpNeed: 1e9, plot: 0, plotNeed: 1e9 });   // freeze level/stage so the 60 s window is stationary
fixture.agents = Array.from({ length: nAgents }, (_, i) => ({ id: i + 1, name: i ? "bot" + i : "you", color: "#0ff", gear: kit(), inv: [], sanity: 100, q: seat[i], done: 0, failed: 0, rogue: null }));
fixture.queues = queues.map(q => ({ tier: q.tier, seats: q.seats, configs: Array(q.tier >= 3 ? 3 : 2).fill(null), bounty: null, nextBounty: 1e9 }));
fixture.up.os = Math.max(...queues.map(q => q.tier));   // the OS that can own the highest queue (ILVL_CAP/HIRE_CAP consistent with the sim)
await ev(`localStorage.setItem('vibehacker', ${JSON.stringify(JSON.stringify(fixture))}); document.cookie='vibehacker=;max-age=0'; localStorage.setItem=function(){}; 'ok'`);
await send("Page.reload"); await sleep(3000);
await ev(`delete localStorage.setItem; 'ok'`);
const read = () => ev(`(()=>{const d=JSON.parse(localStorage.getItem('vibehacker')); return {credits:d.credits, earned:d.earned, xp:d.totalXp, done:d.tasksDone, failed:d.tasksFailed, secs:d.playSecs}})()`);
await ev(`localStorage.setItem('vibehacker', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('vibehacker')),{earned:0,tasksDone:0,tasksFailed:0,totalXp:0}))); 'ok'`);
await sleep(3500);
const a = await read();
const t0 = Date.now();
if (KPS > 0) { const iv = setInterval(() => { send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", text: "a" }); send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA" }); }, 1000 / KPS); await sleep(SECS * 1000); clearInterval(iv); }
else await sleep(SECS * 1000);
await sleep(3500);
const b = await read();
const dtS = b.secs - a.secs;
console.log(JSON.stringify({ kps: KPS, secsPlayed: +dtS.toFixed(1), creditsPerSec: +((b.earned - a.earned) / dtS).toFixed(2), xpPerSec: +((b.xp - a.xp) / dtS).toFixed(2), tasksPerSec: +((b.done + b.failed - a.done - a.failed) / dtS).toFixed(2), successRate: +((b.done - a.done) / Math.max(1, b.done + b.failed - a.done - a.failed)).toFixed(2) }));
chrome.kill();
process.exit(0);
