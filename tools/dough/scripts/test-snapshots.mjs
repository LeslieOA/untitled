import { readFile } from "node:fs/promises";
import fs from "node:fs";
import { Dough, reference } from "../dough.js";
import { SAMPLE_RATE, testSnapshot } from "./snapshots.mjs";

async function main() {
  const wasmBuffer = await readFile("./dough.wasm");
  const dough = new Dough({ server: true });
  const memory = dough.initMemory();
  await dough.initWasm(wasmBuffer, memory, SAMPLE_RATE);

  let all = new Float32Array();

  reference.forEach((entry, s) => {
    entry.examples.forEach((example, i) => {
      const pcm = testSnapshot(dough, entry, example, false);
      const next = new Float32Array(all.length + pcm.length);
      next.set(all, 0);
      next.set(pcm, all.length);
      all = next;
    });
  });
  fs.writeFileSync(`./snapshots/_all.pcm`, all);
}
main();
