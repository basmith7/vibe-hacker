---
id: T-2
title: Embed era-appropriate fonts
status: done
labels:
  - imported
  - theming
depends: []
created: 2026-09-24T08:48:38Z
updated: 2026-09-24T22:44:59Z
---
Era-appropriate fonts embedded (currently system fonts).

Imported from todo.md (Themes & vibe)

## Outcome
Shipped to production 2026-09-24 (main e6db261, merge of idea/t-2-1 e427023). Live at https://basmith.net/vibe-hacker/.
Fonts are base64 woff2 in `<style id="eraFonts">`: Px437 IBM VGA 8x16 (DOS), W95FA (Win 3.1/95), Selawik (Win 10), Share Tech Mono (NEON), Oxanium (STARSHIP). Credits are in README under "Bundled fonts". Verified in headless Chrome on the live site: all six fonts load and nothing throws.
