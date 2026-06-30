// Headless file-watcher: edit sessions/*.dough in your own editor (VS Code /
// Zed / micro) and hear changes on save. The TUI (bun run src/cli.tsx) is the
// primary interface; this is the bring-your-own-editor alternative.
import { watch } from "fs";
import { join } from "path";
import { startDough, playFile } from "./src/dough.ts";

const SESSIONS_DIR = join(import.meta.dir, "sessions");

const dough = startDough(); // inherit stdout → see dough's feedback
console.log(`▶ dough started (pid ${dough.proc.pid})`);

async function send(filename: string) {
  const count = await playFile(dough, join(SESSIONS_DIR, filename));
  console.log(`→ ${count} events from ${filename}`);
}

// Watch sessions/ for saves.
watch(SESSIONS_DIR, { recursive: false }, (_event, filename) => {
  if (filename?.match(/\.(dough|js|tidal)$/)) void send(filename);
});

// Load the most recent session on startup.
const files = await Array.fromAsync(
  new Bun.Glob("*.{dough,js,tidal}").scan(SESSIONS_DIR)
);
if (files.length) {
  const latest = files.sort().at(-1)!;
  console.log(`▶ loading: sessions/${latest}`);
  await send(latest);
}

process.on("SIGINT", () => {
  dough.kill();
  process.exit(0);
});

console.log(`
┌──────────────────────────────────────────┐
│  Generative — dough native audio         │
│                                          │
│  Edit sessions/*.dough in your editor    │
│  Save → dough re-plays immediately       │
│  Ctrl+C to stop                          │
└──────────────────────────────────────────┘
`);

await new Promise(() => {}); // keep alive
