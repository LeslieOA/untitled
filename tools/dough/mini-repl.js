import { Dough, doughsamples } from "./dough.js";
export * from "./dough.js";

export const dough = new Dough();
/* const doughbuffer = new Uint8Array(dough.memory.buffer); */

doughsamples("github:eddyflux/crate");

let replId = 0;

const lerp = (v, min, max) => v * (max - min) + min;
const invLerp = (v, min, max) => (v - min) / (max - min);
const remap = (v, vmin, vmax, omin, omax) =>
  lerp(invLerp(v, vmin, vmax), omin, omax);

class MiniREPL extends HTMLElement {
  active = false;
  static observedAttributes = ["code", "rows"];
  raf;
  replId = replId++;
  constructor() {
    super();
  }
  init() {
    const code =
      this.getAttribute("code") ||
      (this.innerHTML + "").replace("<!--", "").replace("-->", "").trim();
    const rows = this.getAttribute("rows");
    if (!code) {
      return;
    }
    this.innerHTML = "";
    this.insertAdjacentHTML(
      "beforeend",
      `<div class="editor-wrapper">
    <div style="display: flex;position:relative">
      <div style="position:relative;width:100%">
        <textarea spellcheck="false" rows="${rows}" style="resize: none">${code}</textarea>
        <canvas style="position:absolute;bottom:0;left:0;pointer-events:none;width:100%;height:100%;z-index:-1"/>
      </div>
      <div style="position:absolute;top:0;right:0">
        <button class="play" style="width:60px;padding:8px 0">run</button>
        <button class="stop" style="width:60px;padding:8px 0">stop</button>
      </div>
    </div>
  </div>`
    );
    const canvas = this.querySelector("canvas");
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
    /* this.image = new ImageData(canvas.width, canvas.height);
    this.doughview = doughbuffer.subarray(0, this.image.data.length); */

    this.ctx = canvas.getContext("2d");
    // repl logic
    const input = this.querySelector("textarea");
    input.value = code;
    this.input = input;

    document.addEventListener("update-repl", (e) => {
      if (e.detail !== this.replId) {
        this.deactivate();
      }
    });

    input.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.altKey) && e.key === "Enter") {
        this.update(input.value);
      }
      if ((e.ctrlKey || e.altKey) && e.keyCode === 190) {
        // period
        e.preventDefault();
        this.stop();
      }
    });
    const playButton = this.querySelector(".play");
    playButton.addEventListener("click", () => this.update(input.value));
    const stopButton = this.querySelector(".stop");
    stopButton.style.display = "none";
    stopButton.addEventListener("click", () => this.stop());
    this.playButton = playButton;
    this.stopButton = stopButton;
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (let c = 0; c < dough.CHANNELS; c++) {
      this.drawBuffer(ctx, dough.framebuffer, dough.CHANNELS, c, -1, 1);
    }
    this.raf = requestAnimationFrame(this.draw.bind(this));
  }

  drawBuffer(ctx, samples, channels, channel, y0, y1) {
    const lineWidth = 3;
    // prepare draw context
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = "white";
    // divide by 2 because we're ping pong buffering
    const perChannel = samples.length / channels / 2;
    // ranges
    const pingbuffer = dough.frame[0] > samples.length / 2;
    const x0 = pingbuffer ? 0 : perChannel,
      x1 = pingbuffer ? perChannel : perChannel * 2,
      px0 = 0,
      px1 = ctx.canvas.width,
      py0 = ctx.canvas.height - ctx.lineWidth,
      py1 = ctx.lineWidth;
    // actual draw logic
    ctx.beginPath();
    for (let px = 1; px <= ctx.canvas.width; px++) {
      const x = remap(px, px0, px1, x0, x1);
      // xi = sample index in interleaved buffer
      const xi = Math.floor(x) * channels + channel;
      const y = samples[xi];
      // mark clipping red:
      if (y >= 1) {
        ctx.strokeStyle = "red";
      }
      const py = remap(y, y0, y1, py0, py1);
      px === 1 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  /* drawMemory() {
    this.image.data.set(this.doughview);
    this.ctx.putImageData(this.image, 0, 0);
  } */

  activate() {
    this.playButton.style.display = "none";
    this.stopButton.style.display = "block";
    this.active = true;
  }
  deactivate() {
    this.playButton.style.display = "block";
    this.stopButton.style.display = "none";
    this.active = false;
    this.raf = cancelAnimationFrame(this.raf);
    const ctx = this.ctx;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  flash() {
    this.input.classList.remove("evaluated");
    setTimeout(() => {
      this.input.classList.add("evaluated");
    }, 50);
  }

  async update(code) {
    document.dispatchEvent(
      new CustomEvent("update-repl", {
        detail: this.replId,
      })
    );
    this.flash();
    await dough.ready;
    dough.evaluate({ dough: "reset_schedule" });
    dough.evaluate({ dough: !this.active ? "reset" : "hush_endless" });
    // todo: hush only infinite sounds? or maybe duration > x?

    const blocks = code.split("\n\n").filter(Boolean);

    const msgs = await Promise.all(
      blocks.map((block) => {
        const event = dough.parsePath(block);
        return dough.prepare({ dough: "play", ...event });
      })
    );

    if (!this.active) {
      dough.evaluate({ dough: "reset_time" });
      this.activate();
      this.draw();
    }

    msgs.forEach((msg) => dough.send(msg));
  }

  stop() {
    this.deactivate();
    this.raf = cancelAnimationFrame(this.raf);
    dough.hush();
  }

  /* connectedCallback() {
          setTimeout(() => {
            this.init();
          }, 0);
        } */
  attributeChangedCallback(name, oldValue, newValue) {
    this.init();
  }
}
customElements.define("mini-repl", MiniREPL);
