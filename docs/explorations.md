# Explorations — what we tried before landing on dough

A short record of the tools this project passed through, and why it ended up
where it did. Useful context if you ever wonder "why not just use X?".

## 1. TidalCycles + SuperCollider (the original setup)

The first workspace was [TidalCycles](https://tidalcycles.org) — a Haskell
pattern language — driving [SuperCollider](https://supercollider.github.io)
/ SuperDirt for sound.

- **Flow:** boot SuperCollider → `SuperDirt.start`, launch Tidal via
  `ghci -ghci-script BootTidal.hs`, eval lines/blocks from the editor.
- **Why we moved on:** heavy install (GHC + cabal + SuperCollider + SuperDirt +
  Dirt-Samples), several moving parts to keep running, and it lives inside an
  editor rather than being its own thing. Great tool, more stack than this
  project wanted.

The old TidalCycles files (a session, a starter pattern library, notes) were
moved out of the repo — they were generic boilerplate, not project-specific.
They sit alongside the repo at `../_archive-tidal-cycles` and remain in this
repo's early git history.

## 2. Strudel.cc (the browser alternative)

[Strudel](https://strudel.cc) is the JavaScript port of TidalCycles — same
pattern language, zero install, runs in the browser. It's also what our
inspiration **DJ_Dave** (Sarah Davis) uses.

- **Why not this:** it's browser-bound. The goal here was a *terminal* tool —
  no browser tab, no SuperCollider — that still sounds good and starts instantly.

## 3. dough (where we landed)

[dough](https://codeberg.org/uzu/dough) (by uzu, AGPL-3.0-or-later) is a single
C-file native synth engine that also compiles to WASM. We vendor it under
`tools/dough/` and drive it from a Bun/Ink TUI: write `.dough` patterns, hit
evaluate, hear the native engine, loop forever.

- **Why it fits:** native audio, no browser, no SuperCollider, tiny dependency
  surface (PortAudio + a few libs), and `.dough` stays a readable plain-text
  format.
- **Two local patches** were needed to make it loop a whole pattern fed to
  `--repl` (it's tuned upstream for streaming one cycle at a time over OSC):
  raising the scheduler event cap, and switching the audio callback from DAC
  time to the resettable sample clock the WASM path uses. See the **Note** in
  the top-level `README.md` and `setup.ts`'s `patchDough` step for details.

The demo pattern in `sessions/2026-06-29.dough` was transcribed from dough's own
looping web demo at [dough.strudel.cc](https://dough.strudel.cc).
