import { join } from "path";
import { spawn, type Subprocess } from "bun";

const DOUGH_BIN = join(import.meta.dir, "../tools/dough/dough");

export type DoughProcess = {
  proc: Subprocess;
  send: (line: string) => void;
  play: (lines: string[]) => void;
  hush: () => void;
  kill: () => void;
};

export function startDough(opts: { quiet?: boolean } = {}): DoughProcess {
  // In the TUI, Ink owns the terminal — let dough write there and it garbles
  // the render. `quiet` swallows dough's stdout/stderr. In `play` mode we
  // inherit so the user sees dough's "playback started" feedback.
  const stdio = opts.quiet ? "ignore" : "inherit";
  const proc = spawn({
    cmd: [DOUGH_BIN, "--repl"],
    stdin: "pipe",
    stdout: stdio,
    stderr: stdio,
  });

  const send = (line: string) => proc.stdin.write(line + "\n");

  // We let dough do the scheduling, exactly as the web demo does. Each event
  // keeps its `time`/`repeat`, so dough pushes it into its internal schedule
  // and fires it from the audio callback — sample-accurate, no JS-timer jitter.
  // This mirrors dough's own mini-repl.js evaluate sequence:
  //   reset_schedule → (first run? reset : hush_endless) → reset_time (first
  //   run only, to keep phase on live re-eval) → push every play message.
  let active = false;

  const play = (lines: string[]) => {
    send("dough/reset_schedule");
    send(active ? "dough/hush_endless" : "dough/reset");
    if (!active) {
      send("dough/reset_time");
      active = true;
    }
    for (const line of lines) send(line);
  };

  const hush = () => {
    send("dough/reset_schedule");
    send("dough/hush");
    active = false;
  };

  const kill = () => { hush(); proc.kill(); };

  return { proc, send, play, hush, kill };
}

/**
 * Parse .dough text into `dough/play/...` REPL lines. Comments (`--`) and blank
 * lines are dropped; a leading `/` is stripped. `time`/`repeat` are left intact
 * so dough's scheduler loops the pattern itself.
 */
export function parseDoughFile(content: string): string[] {
  return content
    .split("\n")
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("--"))
    .map(l => "dough/play/" + (l.startsWith("/") ? l.slice(1) : l));
}

/** Parse a buffer of .dough text and play it. Returns event count. */
export function playText(dough: DoughProcess, content: string): number {
  const lines = parseDoughFile(content);
  dough.play(lines);
  return lines.length;
}

export async function playFile(dough: DoughProcess, filepath: string): Promise<number> {
  const content = await Bun.file(filepath).text();
  return playText(dough, content);
}
