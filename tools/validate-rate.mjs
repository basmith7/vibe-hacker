// Throwaway: measure real credits/sec + xp/sec in headless Chrome for a fixed state and
// compare with tools/balance-sim.mjs's rate(). Usage: node tools/validate-rate.mjs [kps] [secs]
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
const F = JSON.parse(process.env.FIX || "{}");   // {level, stage, stat, nStats, hire, os, computer, model, ilvl}
const level = F.level ?? 20, stage = F.stage ?? 4, stat = F.stat ?? 20, nStats = F.nStats ?? 3, ilvl = F.ilvl ?? 0;
const ALL = ["coding", "focus", "debug", "systems", "algo"];
Object.assign(fixture, { level, xp: 0, xpNeed: 1e9, intro: false, credits: 0, earned: 0, stage, plot: 0, plotNeed: 1e9, hp: 5000, hpMax: 5000, unlockedStats: ALL.slice(0, nStats) });
for (const k in fixture.stats) fixture.stats[k] = stat;
fixture.up.hire = F.hire ?? 2; fixture.up.os = F.os ?? 1; fixture.up.computer = F.computer ?? 1; fixture.up.model = F.model ?? 0;
fixture.unlocked = { telemetry: true, globe: true, status: true, inventory: true, equipment: true, ide: true, missions: true, achievements: true };
const SLOT_OS = { ram: 0, cpu: 0, harddrive: 0, monitor: 1, modem: 2, gpu: 3, cooling: 4, neural: 5 };
fixture.equip = {}; let seq = 100;
for (const s in SLOT_OS) fixture.equip[s] = (ilvl && SLOT_OS[s] <= fixture.up.os) ? { id: ++seq, slot: s, name: "Fixture " + s, ilvl, patches: [], maxPatches: 4 } : null;
fixture.toolbox = Array.from({ length: 18 }, (_, i) => ({ id: 200 + i, slot: "ram", name: "junk", ilvl: 9999, patches: [], maxPatches: 2 }));   // full stash of "better" junk so drops don't auto-equip/change state
await ev(`localStorage.setItem('vibehacker', ${JSON.stringify(JSON.stringify(fixture))}); document.cookie='vibehacker=;max-age=0'; localStorage.setItem=function(){}; 'ok'`);
await send("Page.reload"); await sleep(3000);
await ev(`delete localStorage.setItem; 'ok'`);
const read = () => ev(`(()=>{const d=JSON.parse(localStorage.getItem('vibehacker')); return {credits:d.credits, earned:d.earned, xp:d.totalXp, level:d.level, done:d.tasksDone, failed:d.tasksFailed, stage:d.stage, hp:d.hp, secs:d.playSecs}})()`);
await ev(`localStorage.setItem('vibehacker', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('vibehacker')),{earned:0,tasksDone:0,tasksFailed:0,totalXp:0}))); 'ok'`);
await sleep(3500);
const a = await read();
const t0 = Date.now();
if (KPS > 0) { const iv = setInterval(() => { send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", text: "a" }); send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA" }); }, 1000 / KPS); await sleep(SECS * 1000); clearInterval(iv); }
else await sleep(SECS * 1000);
await sleep(3500);
const b = await read();
const dtS = b.secs - a.secs;
console.log(JSON.stringify({ kps: KPS, secsPlayed: +dtS.toFixed(1), creditsPerSec: +((b.earned - a.earned) / dtS).toFixed(2), xpPerSec: +((b.xp - a.xp) / dtS).toFixed(2), tasksPerSec: +((b.done + b.failed - a.done - a.failed) / dtS).toFixed(2), successRate: +((b.done - a.done) / Math.max(1, b.done + b.failed - a.done - a.failed)).toFixed(2), levelNow: b.level, stageNow: b.stage, hp: b.hp }));
chrome.kill();
process.exit(0);
