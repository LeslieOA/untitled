# Generative

Live coding music workspace. Inspired by DJ_Dave (Sarah Davis) — algorave artist, Strudel.cc.

## Tools

### TidalCycles (current setup)
Haskell-based pattern language. Boot file at `../Misc/BootTidal.hs`.

**To play:**
1. Open SuperCollider → run `SuperDirt.start`
2. Open a `.tidal` file in VS Code
3. Command Palette → `TidalCycles: Start Tidal`
4. `Shift+Enter` eval line · `Ctrl+Enter` eval block · `Ctrl+Alt+H` silence all

### Strudel.cc (browser alternative)
JavaScript version of TidalCycles. Same pattern language. Zero install.
→ https://strudel.cc

This is what DJ_Dave uses. If moving to a JS/Node-only workflow, Strudel replaces TidalCycles entirely.

## Structure

```
Sessions/      dated session files — one per coding session
Patterns/      reusable patterns and ideas
Samples/       custom audio samples (drop folders here)
```

## Inspiration

**DJ_Dave** (Sarah Davis)
- YouTube: https://www.youtube.com/@dj_dave____
- Twitch: live sets with code visible alongside face
- Linktree: https://linktr.ee/dj_dave
- Tool: Strudel.cc + Sonic Pi
