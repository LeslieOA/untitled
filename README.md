# Generative

A Strudel/TidalCycles-style live-coding TUI for the terminal. Write `.dough`
patterns, evaluate them to hear the native audio engine, and save sessions —
all in one screen. No browser, no SuperCollider.

## Quick start (dev)

```bash
bun run setup.ts          # one-time: checks deps, builds the dough engine

bun run src/cli.tsx       # open the live-coding editor
```

You land straight in the editor on today's session (it resumes
`sessions/YYYY-MM-DD.dough` if it exists, else starts a fresh one). Then:

| Key   | Action                              |
| ----- | ----------------------------------- |
| `^E`  | play — evaluate the buffer          |
| `^S`  | save the session                    |
| `^K`  | hush (silence all)                  |
| `esc` | browse / open / create sessions     |
| `^C`  | quit                                |

In the browser: `↑↓`/`jk` navigate, `↵` open, `n` new session, `esc` back.

Prefer to skip the TUI and just play a file?

```bash
bun run src/cli.tsx play sessions/2026-06-29.dough   # headless
bun run src/cli.tsx 2026-06-29.dough                 # open that one in the editor
```

## How it works

```
TUI editor (Ink) ──^E evaluate──▶ buffer text
                                      │
                         Bun (parse .dough lines)
                                      │ stdin: reset_schedule / reset /
                                      │        reset_time / dough/play/...
                         dough --repl (native C audio engine)
                                      │ schedules + loops in the audio thread
                                  your speakers
```

`src/dough.ts` spawns `tools/dough/dough --repl` and feeds it the whole pattern,
letting **dough do the scheduling** — exactly as the web demo does. Each `.dough`
line keeps its `time`/`repeat`, so dough pushes it into its internal schedule and
fires it from the PortAudio callback, sample-accurately, looping forever. The
evaluate sequence mirrors dough's own `mini-repl.js`: `reset_schedule` →
`reset`/`hush_endless` → `reset_time` → push every `dough/play/...` message.
`^S` writes the buffer to `sessions/`.

> **Note:** the vendored engine has two local patches (in `tools/dough/dough.c`,
> re-applied idempotently by `setup.ts`'s `patchDough` step on a fresh clone):
> (1) the scheduler cap is raised from the upstream 32 events to 512 (32
> truncated the demo to ~17 pitches); (2) the PortAudio callback is switched
> from DAC time to the resettable sample-counter clock (`doughtime`) that the
> WASM path uses — on DAC time, `/time/0../repeat/8` events land "in the past"
> and over-fire into a garbled wall. Upstream's defaults suit Strudel/dirt
> streaming over OSC one cycle at a time; we feed a whole pattern to `--repl`.

Prefer your own editor? `bun run server.ts` watches `sessions/` and re-sends any
file on save — edit in VS Code / Zed / micro and hear changes live.

## Pattern syntax

Each line in a `.dough` file is one sound event: `/key/value/key/value/...`

```
/time/0/duration/2/repeat/8/note/57/lpf/1100/lpe/1/lpd/0.5/lpq/0.1/s/saw
```

Common keys: `time` `duration` `repeat` `note` (MIDI) `freq` `s` (saw/sine/tri/
pulse/zaw) `lpf` (cutoff) `lpq` (resonance) `lpa`/`lpd`/`lpe` (filter env) `vib`
`vibmod` `pan` `speed` `glide` `pw` `distort`. See `tools/dough/dough.c` for the
full parser and `sessions/2026-06-29.dough` for an annotated example.

## Structure

```
src/cli.tsx        entry point (meow): TUI, or `play <file>`
src/app.tsx        Ink root — routes editor ⇄ browser
src/screens/       Editor (write/play/save) + Browser (pick/create sessions)
src/dough.ts       dough subprocess wrapper + .dough parser
setup.ts           dependency + build checks (macOS/Homebrew; Linux/WSL notes)
server.ts          headless file-watcher (edit in your own editor)
sessions/          one .dough file per session
tools/dough/       the native engine (source + compiled binary)
docs/              distribution notes
Archive/           previous TidalCycles setup
```

## Inspiration

**DJ_Dave** (Sarah Davis) — algorave artist, live sets with code in a sidebar.
- YouTube: https://www.youtube.com/@dj_dave____
- Linktree: https://linktr.ee/dj_dave

## License

This project's own code is **MIT** — see [`LICENSE`](./LICENSE).

The bundled audio engine in [`tools/dough/`](./tools/dough/) is a separate
program ([codeberg.org/uzu/dough](https://codeberg.org/uzu/dough)) under
**AGPL-3.0-or-later**, governed by [`tools/dough/LICENSE`](./tools/dough/LICENSE).
We invoke it as a subprocess (stdin / OSC) rather than linking it, so the two
are aggregated, not combined. The local patches to `dough.c` are likewise AGPL.
