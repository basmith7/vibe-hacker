# vibe hacker 🎮🔥

**▶ Play it: https://basmith7.github.io/vibe-hacker/**

A fake "swarm of AI agents furiously coding" cockpit — [hackertyper.net](https://hackertyper.net/)
energy — that's secretly a persistent, [Progress Quest](https://en.wikipedia.org/wiki/Progress_Quest)-style
idle-RPG about a dev career. Spinning globe, four agents grinding tasks, live charts, a streaming git
terminal, and a character sheet that levels up over (fake) weeks. Nothing real runs — but your
progression is real and auto-saves.

## The game

- **Starts tiny, grows wild.** You begin as a **full-screen terminal** that only moves when you type or
  tap — pure [hackertyper](https://hackertyper.net/). Fill the bar once and the credits counter fades in;
  hit 10 credits and the 🛒 shop button appears. From there you **buy your apps one at a time** — hire
  the agent swarm, install telemetry, go global — and each one **tiles into the screen** beside the
  terminal, splitting the layout tmux-style as you grow.
- **5 stats** (Coding, Focus, Debugging, Systems, Algorithms) that level up — you start with just
  Coding and unlock the rest one at a time via the shop.
- **~60 tasks**, each tied to a stat. Your stat vs. the task's difficulty sets success chance and speed;
  clearing a task levels its stat. Fail a roll and you take **Sanity (HP)** damage — hit 0 and you **burn out**.
- **~28 stages** from *Day 1: The Onboarding* to *Singularity Onset*, escalating titles across
  **level 1–100** (Script Kiddie → CTO → **Benevolent AGI**), and loot that boosts stats.
- **Incremental economy** — earn **credits** per task and spend them in the **🛒 Upgrade shop** on coffee,
  one-time **Machine** and **AI Model** tiers, more agents, and automation (offline earnings,
  auto-allocate, auto-buyer). **Hardware isn't bought** — RAM, CPU, Hard Drive, Monitor, GPU, and Modem
  are equip slots filled by drops (or gambled for with credits). Extras land in the **🧰 Toolbox**, a
  filterable stash where you compare candidates, equip, or decommission for credits + materials.
  Stage gear in **🛠 The IDE** to spend those materials on **patches** (Stock → Modded →
  Custom-Built → rare **Legendary Build** uniques). A rotating **📋 Mission Board** biases what you
  earn and pays out bonus materials, Sprint Config, and the occasional item. Two endgame slots —
  ❄️ Cooling and 🔮 Neural Interface — unlock at level 60 and the final OS tier. Level-ups grant
  **skill points** you spend on any stat via the `+` buttons.
- **Prestige** — once you hit Lv 10 you can **IPO / cash out** for **Equity**, a permanent global XP &
  credit multiplier, and start a fresh, stronger run. Plus **22 achievements** that unlock as you play.
- **Evolving UI, bought not given.** Buy **🖥️ Upgrade OS** in the shop to move your rig through computing
  history: **MS-DOS → Windows 3.1 → Windows 95 → Windows 10 → NEON//OS → STARSHIP OS**. Each purchase
  switches your look immediately — but click the OS name (top-left) anytime to switch back to any look
  you've already unlocked. And it's more than a reskin: on **MS-DOS** your apps are **tiled** (tmux-style),
  but buying **Windows 3.1** unbolts them into **real draggable windows** with a **⊞ Start** menu to
  reopen anything you close (desktop only; prestige drops you back to the tiled DOS layout).

See [guide.md](guide.md) for exactly what every stat and upgrade does, and [todo.md](todo.md) for the
future-ideas backlog.

## Controls

- **Mash any key / tap** — grind faster
- **Click the OS name** (top-left) — switch to any look you've unlocked
- **`U`** — open the upgrade shop · **`T`** — cycle your unlocked looks
- **`F11`** — fullscreen (browser native)
- **`Esc`** / **`` ` ``** — boss key (hide behind a fake spreadsheet)
- **`⟲ sudo rm -r /`** (bottom of the shop panel) — wipe your save

Runs fully ambient too, so it works as a background screen. Single self-contained `index.html` — also
runs offline by opening the file directly.

## License

Copyright © 2026 basmith7 — licensed under **AGPL-3.0** ([LICENSE](LICENSE)). Copyleft: modified versions
you distribute *or host* must also be open-sourced under the AGPL.
