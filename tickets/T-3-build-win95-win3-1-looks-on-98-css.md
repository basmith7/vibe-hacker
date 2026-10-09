---
id: T-3
title: Build Win95/Win3.1 looks on 98.css
status: todo
labels:
  - imported
  - theming
depends: []
created: 2026-09-24T08:48:38Z
updated: 2026-09-24T08:48:38Z
---
**Win95/Win3.1 looks on 98.css** — spike (2026-09-17) showed
[98.css](https://github.com/jdan/98.css) (MIT, ~27 KB + 13 KB woff2 fonts, icons already inline SVG)
can't be dropped in (it targets `.window/.title-bar`, not the game's `.panel/.head`) but ~35 lines
of mapping CSS over a copy scoped under `[data-theme="win95"]` gives the real thing: pixel MS Sans
Serif, title-bar gradient, genuine min/✕ sprites on `.wctl`, raised/sunken bevels, arrow scrollbars.
Plan: inline the scoped lib (MIT notice in a header comment, fonts base64'd — also closes the
"fonts embedded" line above for these two eras), map `.panel/.head/.wctl/.card .buy/.card/.agent/
.stat/#taskbar/#startMenu/.modalCard`, let win31 inherit the primitives with its deltas (flat navy
bar, system-menu box instead of ✕), and **delete** the current win95/win31 `!important` blocks
(the mapping needed none). Watch: 98.css's global `button{min-width:75px;min-height:23px}` must be
neutralised or stripped; pixel font wants exactly 11px vs the game's per-element 13px mono
(decide family-only vs true 11px per surface); dark hardcoded bits (hint bar, agent "you" chip,
`kbd`) go dark-on-dark. No usable library exists for DOS/Win10/NEON/STARSHIP — those stay hand-rolled.

Imported from todo.md (Themes & vibe)
