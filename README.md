# vibe hacker 🎮🔥

**▶ Play it: https://basmith7.github.io/vibe-hacker/**

A fake "swarm of AI agents furiously coding" cockpit — [hackertyper.net](https://hackertyper.net/)
energy — that's secretly a persistent, [Progress Quest](https://en.wikipedia.org/wiki/Progress_Quest)-style
idle-RPG about running a dev team. Spinning globe, a roster of agents grinding tickets off a queue, live charts, a streaming git
terminal, and gear that drops and gets crafted over (fake) weeks. Nothing real runs — but your
progression is real and auto-saves.

> **Note:** this branch (`agents-and-queues`) is an in-progress rewrite of the game's systems —
> see [docs/agents-and-queues.md](docs/agents-and-queues.md). The live site still runs the previous
> version until the rewrite is playable end to end.

## The game

You run a **roster of AI agents** — including yourself — that clear tickets off **queues**. Every
agent has the same small sheet: three stats (🎯 Quality, ⚡ Speed, 🧠 Stamina), four gear slots
(🤖 Model, 🧠 Memory, ⚙️ Compute, 🧰 Tools), its own inventory and its own sanity bar. There are
**no agent levels** — an agent is exactly as good as the **item level** of the gear it's wearing,
so the whole progression is drops and crafting. Quality versus the queue's difficulty sets success
chance, Speed sets how fast a ticket clears, failures drain sanity, and an agent at zero sanity
goes rogue — off the board and skimming your bank — until it recovers or you **Kill -9** it. Credits
buy **hires**, **seats** on a queue, **queues** (boards you install), the apps themselves, and **OS
tiers** — and the OS is the spine: it caps how many agents you can
run and how high an item level you can even find.

- **Starts tiny, grows wild.** You begin as a **full-screen terminal** that only moves when you type
  or tap — pure [hackertyper](https://hackertyper.net/). Fill the bar once and the credits counter
  fades in; hit 10 credits and the 🛒 Store appears. From there you **buy your apps one at a time** —
  hire agents, install telemetry, open the Inventory/Equipment/IDE, go global — and each one **tiles
  into the screen**, splitting the layout tmux-style as you grow.
- **Queues** — 📥 Backlog → 🗂 Kanban → 📋 Jira → 📟 PagerDuty → 🗺 The Roadmap → 🏚 Legacy Monolith,
  each harder and far richer than the last, each gated behind an OS tier — bought in order from the
  Store, managed in the **Queues app** (click or drag agents between boards, or park them on the
  Bench).
- **Loot and crafting** — cleared tickets drop gear at the queue's item-level band. Spare gear lands
  in the finding agent's **🧰 Inventory**; stage anything in **🛠 The IDE** to spend materials on
  **patches** (Stock → Modded → Custom-Built).
- **Prestige** — once you've earned $20K you can **IPO / cash out** for **Equity**, a permanent
  **+2% credits** multiplier, and start a fresh, stronger run. Plus **20 achievements**.
- **Evolving UI, bought not given.** Buy **🖥️ Upgrade OS** to move your rig through computing history:
  **MS-DOS → Windows 3.1 → Windows 95 → Windows 10 → NEON//OS → STARSHIP OS**. Each purchase switches
  your look immediately — click the OS name (top-left) anytime to switch back to any look you've
  unlocked. And it's more than a reskin: on **MS-DOS** your apps are **tiled** (tmux-style), but buying
  **Windows 3.1** unbolts them into **real draggable windows** with a **⊞ Start** menu (desktop only;
  prestige drops you back to the tiled DOS layout).

See [guide.md](guide.md) for exactly what every stat and upgrade does, and [todo.md](todo.md) for the
future-ideas backlog.

## Controls

- **Mash any key / tap** — drives your own agent; briefly surges everyone's speed
- **Click the OS name** (top-left) — switch to any look you've unlocked
- **`T`** — cycle your unlocked looks
- **`F11`** — fullscreen · turns on the 🎧 **Deep Work** bonus (+25% credits, +50% sanity regen) while you stay fullscreen
- **`Esc`** / **`` ` ``** — boss key (hide behind a fake spreadsheet)
- **`⟲ sudo rm -r /`** (bottom of the Store app) — wipe your save

Runs fully ambient too, so it works as a background screen. Single self-contained `index.html` — also
runs offline by opening the file directly.

## License

Copyright © 2026 basmith7 — licensed under **AGPL-3.0** ([LICENSE](LICENSE)). Copyleft: modified versions
you distribute *or host* must also be open-sourced under the AGPL.
