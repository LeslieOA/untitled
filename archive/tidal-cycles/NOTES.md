# Music Research Notes

## Inspiration

### DJ_Dave (Sarah Davis)
Algorave / live coding artist. Platinum blonde, headphones, code visible on screen.
Started live coding in 2021. "always learning."

**Primary tool:** Strudel.cc — browser-based JavaScript version of TidalCycles. No install needed.
Also uses: Sonic Pi (Ruby)

**Where to follow:**
- YouTube: https://www.youtube.com/@dj_dave____ (shorts + longer sets, 31.9k subs)
- Twitch: live coding streams (code in sidebar — the format that inspired this folder)
- Linktree: https://linktr.ee/dj_dave
- GitHub: https://github.com/algorave-dave

**Reference:** Went viral June 14 2025 via @banteg tweet ("guys?") — 3.3M views.
TEDx talk: "If code can make music, what will you make?" — TEDxCornell

---

## Tools in this repo

### TidalCycles (local)
- Boot file: `Misc/BootTidal.hs`
- Requires: SuperCollider + SuperDirt running, then `ghci -ghci-script BootTidal.hs`
- GHCi 9.12.2, TidalCycles 1.10.1 (cabal store)
- SuperCollider.app + SuperDirt + Dirt-Samples already installed

### Strudel.cc (browser)
- No install: open https://strudel.cc
- Same pattern language as TidalCycles, runs in browser
- This is what DJ_Dave uses
