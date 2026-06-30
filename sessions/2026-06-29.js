// Session: 2026-06-29
// Save this file → browser plays instantly
// Reference: strudel.cc/learn

// ── kick off ──────────────────────────────────────────────────
$: s("bd ~ sn ~")

// ── drum stack ───────────────────────────────────────────────
$: stack(
  s("bd*2"),
  s("~ sn"),
  s("hh*8").gain(0.6)
)

// ── melody ───────────────────────────────────────────────────
$: note("0 3 7 10").s("superpiano").gain(0.8)

// ── bass ─────────────────────────────────────────────────────
$: note("<0 -5 -7 -3>").s("supersaw").lpf(800).gain(0.9)

// ── silence all ──────────────────────────────────────────────
// $: silence
