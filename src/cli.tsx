#!/usr/bin/env bun
import { render } from "ink";
import meow from "meow";
import { createElement } from "react";
import App from "./app.tsx";
import { startDough, playFile } from "./dough.ts";
import { join, basename } from "path";

const cli = meow(
  `
  Usage
    $ generative                     open the live-coding editor
    $ generative <file.dough>        open a specific session in the editor
    $ generative play <file.dough>   play a file headlessly (no TUI)

  Options
    --version   show version

  Editor
    ^E          play (evaluate the buffer)
    ^S          save the session
    ^K          hush (silence all)
    esc         browse sessions
    ^C          quit

  Browser
    ↑↓ / j k    navigate    ↵ open    n new    esc editor    q quit
  `,
  {
    importMeta: import.meta,
    flags: {},
  }
);

const [command, ...args] = cli.input;

if (command === "play") {
  // Direct play mode — no TUI
  const filename = args[0];
  if (!filename) {
    console.error("Usage: generative play <file.dough>");
    process.exit(1);
  }

  const filepath = filename.startsWith("/")
    ? filename
    : join(process.cwd(), filename);

  const dough = startDough();
  console.log(`▶ playing ${filepath}`);

  const count = await playFile(dough, filepath);
  console.log(`  ${count} events sent`);
  console.log("  Ctrl+C to stop");

  process.on("SIGINT", () => {
    dough.kill();
    process.exit(0);
  });

  await new Promise(() => {}); // keep alive
} else {
  // TUI mode.
  if (!process.stdin.isTTY) {
    console.error(
      "The TUI needs an interactive terminal.\n" +
        "Run it directly in your shell, or play a file headlessly:\n" +
        "  bun run src/cli.tsx play sessions/<file>.dough"
    );
    process.exit(1);
  }

  // Start dough once here so the process is guaranteed live before the first
  // render (no async race) and Ink doesn't have to manage it.
  const dough = startDough({ quiet: true });

  // On some terminals Bun drains the event loop right after the first render
  // and exits the Ink app instead of blocking on input. This no-op keep-alive
  // holds the process open until the user actually quits.
  const keepAlive = setInterval(() => {}, 1 << 30);

  // `generative <file>` opens that session; Editor resolves names within
  // sessions/, so pass just the basename.
  const file = command ? basename(command) : undefined;
  const { waitUntilExit } = render(createElement(App, { dough, file }));
  await waitUntilExit();

  clearInterval(keepAlive);
  dough.kill();
}
