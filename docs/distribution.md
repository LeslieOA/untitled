# Distribution — Bun platform binary

The goal: ship `generative` as a single self-contained executable, so a user can
run it without installing Bun, Node, or the JS dependencies. Bun's
`--compile` bundles the runtime + your code into one binary.

## Build

```bash
bun build --compile --target=bun-darwin-arm64 ./src/cli.tsx --outfile dist/generative
```

Cross-compile for other platforms by changing `--target`:

| Platform            | `--target`           |
| ------------------- | -------------------- |
| macOS Apple Silicon | `bun-darwin-arm64`   |
| macOS Intel         | `bun-darwin-x64`     |
| Linux x64           | `bun-linux-x64`      |
| Linux ARM           | `bun-linux-arm64`    |
| Windows x64         | `bun-windows-x64`    |

A convenience script (add to `package.json` when ready):

```jsonc
"scripts": {
  "build:macos": "bun build --compile --target=bun-darwin-arm64 ./src/cli.tsx --outfile dist/generative",
  "build:linux": "bun build --compile --target=bun-linux-x64   ./src/cli.tsx --outfile dist/generative-linux"
}
```

## The catch: the dough binary

`--compile` bundles **JS/TS only**. It does *not* bundle `tools/dough/dough`,
which is a separately-compiled native C executable that the JS spawns at
runtime. The compiled `generative` still shells out to it.

`src/dough.ts` currently resolves the engine relative to the source file:

```ts
const DOUGH_BIN = join(import.meta.dir, "../tools/dough/dough");
```

Inside a compiled binary `import.meta.dir` points into Bun's virtual bundle, not
a real directory, so this path won't exist. Two options for shipping:

1. **Sidecar (simplest).** Distribute a folder, not a lone file:

   ```
   generative            # compiled CLI
   tools/dough/dough      # native engine, next to it
   ```

   Resolve the engine relative to the executable instead of the bundle:

   ```ts
   import { dirname, join } from "path";
   const exeDir = dirname(process.execPath);   // where `generative` lives
   const DOUGH_BIN = join(exeDir, "tools/dough/dough");
   ```

2. **Embed + extract.** Use `Bun.embeddedFiles` / `--compile`'s asset embedding
   to carry the dough binary inside `generative`, then write it to a temp/cache
   dir (e.g. `~/.cache/generative/dough`) and `chmod +x` on first run. One file
   to ship, but extraction logic to maintain. Note the engine is
   platform-specific, so each target needs its matching dough build embedded.

Recommendation: start with the **sidecar** — it matches how dough is already
laid out in `tools/dough/`, and keeps the native build (`setup.ts` →
`build-native.sh`) decoupled from the JS bundling step.

## Native dependencies

dough links against PortAudio, libsndfile, liblo, libsamplerate (see
`setup.ts`). The *compiled JS binary* has none of these dependencies — they
belong to dough. So for a real distribution you'd either:

- require users to `brew install` / `apt install` those libs (document it), or
- statically link them into the dough build, or
- bundle the dylibs alongside and set an rpath.

For local/personal use the `setup.ts` Homebrew path already covers this; the
above only matters when distributing to machines that never ran `setup.ts`.
