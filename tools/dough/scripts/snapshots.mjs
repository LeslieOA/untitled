// node dough.test.mjs && play -t raw -r 44100 -e float -b 32 -c 2 dough.pcm
// play requires sox
// generates dough.wav

import fs from "node:fs";

function logBuffer(buffer) {
  const pretty = Array.from(buffer.slice(0, 16))
    .map((n) => Number(n).toFixed(n < 0 ? 2 : 3))
    .join(" ");
  console.log(pretty);
}

export const SAMPLE_RATE = 44100;

// dough: Dough, example: Dough.reference[]
export function runExample(dough, example) {
  dough.schedule({ dough: "reset" });
  const blocks = example.split("\n\n");
  const { CHANNELS, BLOCK_SIZE, output } = dough;
  let maxend = 0;
  blocks.forEach((block) => {
    let json = { dough: "play", ...dough.parsePath(block) };
    const { time = 0, duration = 0.25, release = 0 } = json;
    const end = Number(time) + Number(duration) + Number(release);
    if (isNaN(end)) {
      throw new Error("could not determine end of sound");
    }
    maxend = Math.max(end, maxend);
    dough.schedule(json);
  });
  const pcm = new Float32Array(maxend * SAMPLE_RATE * CHANNELS);

  let tick = 0;
  while (tick < pcm.length) {
    dough.dsp();
    for (let i = 0; i < BLOCK_SIZE; i++) {
      tick++;
      pcm[tick * CHANNELS] = output[i * CHANNELS + 0];
      pcm[tick * CHANNELS + 1] = output[i * CHANNELS + 1];
    }
  }
  return pcm;
}

export function testSnapshot(dough, entry, example, overwrite = false) {
  // console.log("run", entry, example);
  const i = entry.examples.indexOf(example);
  const filepath = `./snapshots/${entry.name}_${i}.pcm`;
  const pcm = runExample(dough, example);
  const exists = fs.existsSync(filepath);
  if (!exists && overwrite) {
    console.log(`📸 ${filepath}`);
    fs.writeFileSync(filepath, pcm);
    return pcm;
  }

  if (!exists) {
    console.log(`🔴 ${filepath}`);
    throw new Error(
      `no snapshot found for ${filepath}. run ./scripts/write-snapshots.sh first.`
    );
  }

  const filebuf = fs.readFileSync(filepath);
  const filedata = new Float32Array(
    filebuf.buffer,
    filebuf.byteOffset,
    filebuf.length / 4
  );
  const matches =
    pcm.length === filedata.length &&
    pcm.every((v, i) => Math.abs(v - filedata[i]) < 1e-6);
  // ^ we tolerate veeery small errors due to floats being floats

  if (overwrite) {
    if (!matches) {
      console.log(`📸 ${filepath}`);
      fs.writeFileSync(filepath, pcm);
    } /* else {
      console.log(`skip ${filepath}`);
    } */
    return pcm;
  }
  if (!matches) {
    console.log(`🔴 ${filepath}`);
    console.log("before:");
    logBuffer(filedata);
    console.log("now:");
    logBuffer(pcm);
    throw new Error(`${filepath} doesn't match!`);
  }
  console.log(`🟢 ${filepath}`);
  return pcm;
}
