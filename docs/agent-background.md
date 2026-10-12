# Agent background

Context moved out of `AGENTS.md` because it doesn't change what an agent does every session.
Read it when the task touches the area in question.

## Project history and current state

The "crafting update" (Path-of-Exile-style itemization) shipped in 7 phases; see
`docs/crafting-update.md`. The old flat Hardware upgrades became equip slots fed by drops/gambling, a
stash + IDE crafting bench, patches/rarity, a materials economy and a rotating Mission Board.

`docs/window-manager.md` (Phases 1-4 shipped, Phase 5 next) reworks the UI into an OS-like progression:
a day-1 terminal, tmux-style tiled panes as apps are bought, then draggable/minimizable windows + Start
Menu unlocked by the "Windows 3.1" OS tier (`P.up.os >= 1`). The shop is now a set of apps (Store,
Equipment, Inventory, IDE, Missions); the slide-out drawer is gone.

The Agents & Queues rewrite restructures the game around a **Desktop** (OS ladder, apps, queues and
their seats) and **Agents** (a roster where every agent, including you, has the same sheet: three
stats, four gear slots, inventory, sanity, no levels). Phases 1-3 are shipped on branch
`agents-and-queues`; Phase 4 (Automation, rogue types, Red Team, docs pass) is next. See
`docs/agents-and-queues.md` `## Status`. `main` still runs the old game and auto-deploys, so the branch
merges only when the rewrite is playable end to end.

## Architecture notes

- **Save format.** `PERSIST` lists the `P` keys saved (cookie + localStorage mirror). `loadState()`
  only overwrites keys present in the loaded JSON, so a new field needs only `defaults()` + `PERSIST`.
  The old migration ladder was deleted when the no-migrations rule was adopted (players are the owner
  plus friends).
- **OS tier as spine.** `P.up.os` gates queue tiers (`QUEUE_TIERS[].os`), the agent cap (`HIRE_CAP`),
  item-level ceiling (`ILVL_CAP`), Automation items (`UPG[].reqOs`), the window paradigm (`wmFloat()`)
  and retro item names.
- **State shapes.** `P.agents[]` is `{id, name, color, gear:{model,memory,compute,tools}, inv, sanity,
  q (-1 = Bench), done, failed, rogue:{mode,t,stolen}|null}`; agent zero is you (manual; hires are
  automatic). `P.queues[]` is `{tier, seats, mods, configs}`, one per owned queue, in `QUEUE_TIERS`
  order. `P.selectedAgent` is what Equipment/Inventory/IDE act on; `P.craftSlot` is `{owner, item}`.
- **Rogue** is a table: `ROGUE_MODES[mode].tick(a, dt, w)` runs at the top of `tickWorker` (pauses with
  the boss key, never runs offline). `kill9Cost(a)` is `BAL.kill9PerIlvl x sum of gear ilvl`.
- **Queue mods.** `queueMods(q)` sums the `kind:"mod"` patches on `q.configs` into
  `{d, pay, band, speed, mats}` on every call. `a.m.dur(D, q)` takes the queue so it can read `speed`;
  `queueD`, `queueBandTop`, `a.m.payout` and `grantMaterials` are the other readers.
- **Configs** are items with `slot:"config"` (same shape as gear), so stash cards, `INV_CAP`,
  decommission and `P.craftSlot` work unchanged. `slotDef(item)` and `patchFits(def, item)` are the
  polymorphism points (Configs take only `kind:"mod"` patches, gear only non-mod).
  `socketConfig`/`unsocketConfig` both go through `openSocketPicker`.
- **Bounties** are derived, not stored: `bountyWorked(q)` asks `WK` whether a non-manual worker already
  has `w.task.bounty && w.task.q === q`, so after a reload the next free agent re-takes an unclaimed
  bounty. `tickBounties` runs inside `tickProgress` (pauses with the boss key and hidden tabs);
  `offlineEarnings` ignores bounties (Pager Integration, Phase 4, is the planned exception).
  `releaseBountyTasks` downgrades an in-flight bounty ticket when its bounty expires. Faucets: ordinary
  tickets pay only credits + Commits (+ the LOC-milestone Full Rewrite); Hotfix/Refactor/Revert/Merge,
  gear near the top of a band, and Configs come from bounties only.
- **`agentMult(a)`** writes `a.m = {st, chance(D), dur(D), payout(D,q), sanityMax, regen}` from
  `agentStats(a)` (gear ilvl + patches + `BAL.floor`), Equity and Deep Work. `MULT` is vestigial.
- **Shop UI.** `buildShop()/renderShop()` and `buildToolbox()/renderToolbox()` build DOM once, then
  update on a timer (`slotEls`/`matEls` caches). Team cards (`q_<tier>` Install, `seat_<tier>` Seat) are
  generated from `QUEUE_TIERS`; `isRevealed()` owns the Team section's visibility (hidden until the
  Queues app is bought; install cards need the previous board; seat cards need their board).
- **Deep Work (`syncFocusMode`)**: detection needs both the Fullscreen API and the
  `display-mode: fullscreen` media query, since F11 only triggers the latter. Effects apply in
  `agentMult()` behind `focusOn`.
- **IDE crafting bench** is a ring: each `CRAFT_ACTIONS` row has material, label, unit-circle `x`/`y`,
  validity predicate and unavailable-reason. `fitBench()` (a `ResizeObserver` on `#benchWrap`) sizes the
  ellipse in JS and flips to a stacked `.narrow` fallback under ~270px.
- **Float-mode windows**: `WIN_LAYOUT` is `{c, r, h}` grid units (4 columns x 7 half-rows), scaled by
  `defaultWindows()` to the live `#grid`.
- **Era fonts** are base64 woff2 in `<style id="eraFonts">`. Themes use them via `--mono` (DOS, NEON)
  or a `body{font-family}` override (Win 3.1/95/10, STARSHIP). Credits: that block's comment and
  README's "Bundled fonts".

## Balance validation detail

- `FIX='{"agents":3,"ilvl":10}' node tools/validate-rate.mjs 0 60` measures live play;
  `FIX=... node tools/aq-sim.mjs --probe --craft 0` prints the model's number. They should agree
  within ~20% at kps 0. Both accept `queues` (`[{tier, seats}]`), `seat` (queue index per agent, -1 =
  Bench) and `mods` (`[{d,pay,band,speed,mats}, ...]` per queue; the validator synthesises one socketed
  Config per queue). Example multi-queue fixture:
  `{"agents":3,"ilvl":30,"queues":[{"tier":0,"seats":2},{"tier":1,"seats":1}],"seat":[0,0,1]}`.
- 60 s is noisy (lumpy completions); use 120 s before calling a gap drift.
- `--probe` reports ticket income only (the validator fixture suppresses bounties). A live game with
  bounties reads higher: bounties are 15-16% of income at every OS per `--checks`. Not drift.
- Compare at a fixture with >=90% success; at overreach the sim prices Kill -9 cycling into steady
  state, which a 120 s live sample won't match by design.
- `tools/balance-sim.mjs` models the old economy on `main`.
- `smoke.mjs` cleans its Chrome scratch dirs (`rmSync` on the `mkdtemp` dir in `done()`, skipped under
  `--keep`); don't reintroduce a leak.

## Known, deliberate simplifications (not bugs)

- OS-locked Store cards still reveal on the normal 50%-saved rule and show a lock button: it's the
  roadmap. The Equipment app does the same for locked slots.
- The DOS theme's `:root[data-theme="dos"] .card .buy{...!important}` forces all `.card .buy` buttons
  bright green, including disabled ones. Pre-existing; part of the theme-CSS DRY work.
- Decommissioning gear refunds credits + a flat material amount regardless of rarity. Intentional.
