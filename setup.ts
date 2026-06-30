#!/usr/bin/env bun
/**
 * setup.ts — Generative environment setup
 *
 * macOS (primary):  bun run setup.ts
 * Linux / WSL:      see comments marked [Linux] below
 *
 * What this does:
 *   1. Checks Bun version
 *   2. Installs native audio dependencies via Homebrew
 *   3. Installs JS dependencies (bun install)
 *   4. Compiles dough from source
 *   5. Verifies the binary works
 */

import { join } from "path";

// ─── helpers ──────────────────────────────────────────────────────────────────

const ROOT = import.meta.dir;
const DOUGH_DIR = join(ROOT, "tools", "dough");
const DOUGH_BIN = join(DOUGH_DIR, "dough");

type Result = { ok: boolean; message: string };

function ok(message: string): Result   { return { ok: true,  message }; }
function fail(message: string): Result { return { ok: false, message }; }

function log(label: string, result: Result) {
  const icon = result.ok ? "✓" : "✗";
  const colour = result.ok ? "\x1b[32m" : "\x1b[31m";
  console.log(`  ${colour}${icon}\x1b[0m  ${label}: ${result.message}`);
}

async function run(cmd: string[]): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  return { code, out: out.trim(), err: err.trim() };
}

async function exists(path: string): Promise<boolean> {
  return Bun.file(path).exists();
}

// ─── checks ───────────────────────────────────────────────────────────────────

async function checkBun(): Promise<Result> {
  const MIN = [1, 2, 0];
  const { out } = await run(["bun", "--version"]);
  const parts = out.replace(/^v/, "").split(".").map(Number);
  const ok_ = parts[0] > MIN[0]
    || (parts[0] === MIN[0] && parts[1] > MIN[1])
    || (parts[0] === MIN[0] && parts[1] === MIN[1] && parts[2] >= MIN[2]);
  return ok_ ? ok(`v${out}`) : fail(`v${out} — need ≥ ${MIN.join(".")}`);
}

async function checkPlatform(): Promise<Result> {
  const { out } = await run(["uname", "-s"]);
  if (out === "Darwin") return ok("macOS");
  if (out === "Linux")  return ok("Linux (see [Linux] notes in this file)");
  return fail(`unsupported platform: ${out}`);
}

async function checkHomebrew(): Promise<Result> {
  /**
   * [Linux] Replace Homebrew with apt / pacman:
   *   sudo apt install pkg-config liblo-dev portaudio19-dev libsndfile1-dev libsamplerate0-dev
   *   (Arch) sudo pacman -S pkg-config liblo portaudio libsndfile libsamplerate
   *
   * [WSL] Same as Linux (apt). Also ensure PulseAudio or PipeWire is running
   *   for audio output — dough uses PortAudio which talks to the system audio daemon.
   *   See: https://github.com/microsoft/wslg for WSLg audio support.
   */
  const { code, out } = await run(["which", "brew"]);
  if (code !== 0) return fail("not found — install from https://brew.sh");
  const { out: ver } = await run(["brew", "--version"]);
  return ok(ver.split("\n")[0]);
}

const BREW_DEPS: Array<{ name: string; formula: string }> = [
  { name: "pkg-config",   formula: "pkgconf" },       // header/lib discovery for C compiler
  { name: "liblo",        formula: "liblo" },          // OSC implementation (dough's OSC mode)
  { name: "portaudio",    formula: "portaudio" },      // cross-platform audio I/O
  { name: "libsndfile",   formula: "libsndfile" },     // sample file reading (.wav, .aiff…)
  { name: "libsamplerate",formula: "libsamplerate" },  // high-quality sample-rate conversion
];

async function checkBrewDep(formula: string): Promise<Result> {
  const { code } = await run(["brew", "list", formula]);
  if (code === 0) return ok("already installed");
  console.log(`      installing ${formula}…`);
  const { code: ic, err } = await run(["brew", "install", formula]);
  return ic === 0 ? ok("installed") : fail(err.split("\n")[0]);
}

async function checkNodeDeps(): Promise<Result> {
  const lockfile = join(ROOT, "bun.lockb");
  if (!(await exists(lockfile))) {
    const { code, err } = await run(["bun", "install", "--cwd", ROOT]);
    return code === 0 ? ok("installed") : fail(err.split("\n")[0]);
  }
  // lockfile exists — fast check that node_modules is present
  const nm = join(ROOT, "node_modules", "ink");
  if (!(await exists(nm))) {
    const { code, err } = await run(["bun", "install", "--cwd", ROOT]);
    return code === 0 ? ok("installed") : fail(err.split("\n")[0]);
  }
  return ok("up to date");
}

async function checkDoughSource(): Promise<Result> {
  const src = join(DOUGH_DIR, "dough.c");
  if (!(await exists(src))) {
    console.log("      cloning dough from codeberg…");
    const { code, err } = await run([
      "git", "clone", "--depth=1",
      "https://codeberg.org/uzu/dough.git",
      DOUGH_DIR,
    ]);
    return code === 0 ? ok("cloned") : fail(err.split("\n")[0]);
  }
  return ok("source present");
}

async function patchDough(): Promise<Result> {
  // Two local patches to the vendored engine, both idempotent (key off the
  // stock text, no-op once applied). Upstream is built for Strudel/dirt to
  // stream events over OSC one cycle at a time; we feed a whole .dough pattern
  // to --repl and let dough loop it, which needs both fixes:
  //
  //  1. Caps: the native main boots with a 32-event schedule, which truncated
  //     the demo to ~17 pitches. Raise voices/orbits/delay/events.
  //  2. Clock: the PortAudio callback drives the schedule on DAC time (large,
  //     non-resettable), so /time/0../repeat/8 events land "in the past" and
  //     the catch-up loop over-fires them → garbled audio. Switch it to the
  //     resettable sample-counter clock (doughtime) the WASM dsp() path uses.
  const src = join(DOUGH_DIR, "dough.c");
  let text = await Bun.file(src).text();
  const before = text;
  const notes: string[] = [];

  const stockCaps = "dough_init(44100, 32, 1, 1, 0, 32);";
  const raisedCaps = "dough_init(44100, 128, 4, 2, 0, 512);";
  if (text.includes(stockCaps)) {
    text = text.replace(stockCaps, raisedCaps);
    notes.push("raised caps 32→512");
  }

  const stockClock =
    "schedule_update(&schedule, time);\n\n    gen_sample(&engine, output, i);";
  const fixedClock =
    "schedule_update(&schedule, doughtime);\n    tick++;\n    doughtime = tick / engine.sr;\n\n    gen_sample(&engine, output, i);";
  if (text.includes(stockClock)) {
    text = text.replace(stockClock, fixedClock);
    notes.push("callback → sample clock");
  }

  if (text === before) return ok("already patched");
  await Bun.write(src, text);
  if (await exists(DOUGH_BIN)) await run(["rm", "-f", DOUGH_BIN]); // force recompile
  return ok(notes.join(" + "));
}

async function checkDoughBinary(): Promise<Result> {
  if (await exists(DOUGH_BIN)) {
    // Quick sanity check that it's actually executable
    const { code } = await run([DOUGH_BIN, "--help"]);
    if (code === 0 || code === 1) return ok("already compiled");
    // Binary exists but broken — recompile
  }

  console.log("      compiling dough (this takes ~10s)…");
  /**
   * [Linux] build-native.sh uses pkg-config to find deps.
   * The same script works on Linux if you installed the apt packages above.
   * You may need: sudo apt install gcc make
   */
  const buildScript = join(DOUGH_DIR, "scripts", "build-native.sh");
  const { code, err } = await run(["bash", buildScript]);
  if (code !== 0) return fail(err.split("\n")[0] || "compilation failed");

  if (!(await exists(DOUGH_BIN))) return fail("binary not found after build");
  await run(["chmod", "+x", DOUGH_BIN]);
  return ok("compiled");
}

async function checkDoughRuns(): Promise<Result> {
  /**
   * Pipe a single hush command to dough --repl and check it starts cleanly.
   * dough outputs "playback started" on success.
   */
  const proc = Bun.spawn([DOUGH_BIN, "--repl"], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  proc.stdin.write("dough/hush\n");
  proc.stdin.end();

  const timeout = setTimeout(() => proc.kill(), 3000);
  const [out] = await Promise.all([new Response(proc.stdout).text()]);
  clearTimeout(timeout);

  return out.includes("playback started")
    ? ok("dough responds correctly")
    : fail(`unexpected output: ${out.slice(0, 60)}`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

console.log("\n\x1b[1mgenerative — setup\x1b[0m\n");

const steps: Array<[string, () => Promise<Result>]> = [
  ["bun",               checkBun],
  ["platform",          checkPlatform],
  ["homebrew",          checkHomebrew],
  ...BREW_DEPS.map(d => [`brew: ${d.name}`, () => checkBrewDep(d.formula)] as [string, () => Promise<Result>]),
  ["js dependencies",   checkNodeDeps],
  ["dough source",      checkDoughSource],
  ["dough patches",     patchDough],
  ["dough binary",      checkDoughBinary],
  ["dough audio test",  checkDoughRuns],
];

let failed = false;
for (const [label, check] of steps) {
  try {
    const result = await check();
    log(label, result);
    if (!result.ok) { failed = true; break; }
  } catch (e: any) {
    log(label, fail(e.message));
    failed = true;
    break;
  }
}

if (!failed) {
  console.log(`
\x1b[32m  ✓  setup complete\x1b[0m

  Start playing:
    bun run src/cli.tsx                        \x1b[2m# TUI session browser\x1b[0m
    bun run src/cli.tsx play sessions/*.dough  \x1b[2m# play a file directly\x1b[0m
`);
} else {
  console.log("\n\x1b[31m  setup failed — fix the error above and re-run\x1b[0m\n");
  process.exit(1);
}
