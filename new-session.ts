// bun run new-session.ts  — creates a dated session file and opens it
import { join } from "path";

const date = new Date().toISOString().slice(0, 10);
const path = join(import.meta.dir, "sessions", `${date}.js`);

const exists = await Bun.file(path).exists();
if (!exists) {
  await Bun.write(path, `// Session: ${date}
// Save to play • strudel.cc/learn for reference

$: s("bd ~ sn ~")
`);
  console.log(`Created: sessions/${date}.js`);
} else {
  console.log(`Already exists: sessions/${date}.js`);
}

// Open in VS Code if available
const { execa } = await import("bun");
Bun.$`code ${path}`.catch(() => console.log(`Open: sessions/${date}.js`));
