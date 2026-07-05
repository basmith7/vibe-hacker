# vibe hacker 🎮🔥

A fake "swarm of AI agents furiously coding" cockpit — [hackertyper.net](https://hackertyper.net/)
energy — that is secretly a persistent, [Progress Quest](https://en.wikipedia.org/wiki/Progress_Quest)-style
idle-RPG about a dev career. A spinning wireframe globe with arcs flying between nodes, four autonomous
"agents" grinding tasks, live telemetry charts, a streaming git/CI terminal, and a full character sheet
that levels up over (fake) weeks and months.

Everything is **decorative/fake** — no real code runs and no network is used — but the progression is
**real and persistent**: it saves to a cookie (with a localStorage fallback so it survives even from
`file://`) and picks up where you left off.

## Run it

Open the file — `open index.html` (macOS) / `xdg-open index.html` (Linux), or just double-click it.
Single self-contained file, works fully offline. Your career auto-saves every few seconds.

## The game

- **8 stats** — Git-Fu ⚡, Focus 🧠, Debugging 🐛, Architecture 🏛, DevOps 🚀, Algorithms 🧮, Rizz ✨, Caffeine ☕.
- **~64 random tasks**, each tied to a stat ("Corner the Heisenbug" → Debugging, "Survive the standup" → Rizz).
  The four agents pull tasks in parallel.
- **Stats drive outcomes.** Your relevant stat vs. the task's difficulty sets the **success chance and speed**.
  Completing a task **levels up its stat**, so you get better at what you practice. Cross-effects:
  **Focus** speeds every task, **Rizz** softens damage, **Caffeine** speeds sanity recovery.
- **Failure & damage.** A failed roll deals damage to your **Sanity (HP)** bar and breaks your streak.
  Hit 0 → **BURNOUT** (lose XP, forced recovery). Leveling up raises max HP and fully heals you.
- **~28 stages ("weeks")** — a career campaign from *Day 1: The Onboarding* → *On-Call Baptism* →
  *The Rewrite (in Rust)* → *The IPO Crunch* → *The AGI Project* → *Singularity Onset*, then infinite New Game+.
- **Titles** escalate with level: Script Kiddie → … → 10x Engineer → CTO → **Benevolent AGI**.
- **Loot** drops on success and grants small permanent stat boosts.
- **Everything is wired to progression** — top counters (tasks/streak/loot/sanity), charts (XP/sec, your
  stat sheet as bars, failure rate, sanity gauge), globe arcs (green = success, red = failure), the terminal
  event log, and the celebration banners on level-ups, stage-clears, combos, and burnouts.

## Controls

| Key            | Does                                                              |
| -------------- | ---------------------------------------------------------------- |
| **Mash anything** | Grind harder — speeds up tasks, nudges XP/stage, spins the globe, more chaos (decays back after a couple seconds) |
| **`F11`**      | Fullscreen (your browser's native shortcut — the app doesn't bind `F`) |
| **`Esc`** or **`` ` ``** | Boss key — hide behind a boring "recalculating spreadsheet" screen; press again to resume |
| **`⟲ reset`** (top-right) | Wipe your save and start over from Day 1 (asks first)  |

Runs fully ambient with zero input too, so it works as a second-monitor / stream background that's
always slowly leveling up.

## License

Copyright © 2026 basmith7

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0) — see [LICENSE](LICENSE).

This is copyleft: you're free to use, modify, and share it, but any modified version you
distribute **or host as a network service** must also be released under the AGPL-3.0 with its
source made available to users.
