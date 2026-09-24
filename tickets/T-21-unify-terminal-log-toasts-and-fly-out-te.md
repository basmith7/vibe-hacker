---
id: T-21
title: Unify terminal log, toasts, and fly-out text into a Notification Center
status: todo
labels:
  - imported
  - ui
depends: []
created: 2026-09-24T08:48:38Z
updated: 2026-09-24T08:48:38Z
---
**"Notification Center" — unify all three feeds into one purchasable system.** Right now the
terminal build/CI/git log (the scrolling text under the Terminal — `#termBody`/`termLine`, e.g.
"→ started ‹Write a for-loop›", "completed mission: Algorithm Grind (+1 commit)") is separate
from toasts and fly-out meme text. The vision: fold the terminal log **together with** toasts and
fly-out text into one "Notification Center" you buy as a single upgrade — the log itself becomes
part of the notification system, not a permanently-on panel. Then a **separate** purchase unlocks
**filtering notifications by type**. Note this reframes what shipped in playtest-batch-2 (which
split it into `🔔 Push Notifications` + `🎉 Hype Banners` with *free* per-type toggles in the
Store): the new direction is one umbrella "Notification Center" purchase, with type-filtering
pulled out as its own paid upgrade rather than a free setting. Decide how the terminal log's
always-on status reconciles with being gated (it's currently the day-1 immersive surface).

Imported from todo.md (UI / polish)
