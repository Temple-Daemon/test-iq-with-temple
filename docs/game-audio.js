/* ============================================================
   MEMORY RUSH — battle audio (synthesized, no assets)
   ------------------------------------------------------------
   All sounds are generated with the Web Audio API at runtime,
   so there are no audio files to download. Every call is
   fail-safe: if Web Audio is unsupported or blocked, methods
   silently no-op and the game keeps working.
   ============================================================ */
(function () {
"use strict";

let ctx = null;      // AudioContext, created on first user gesture
let master = null;   // master gain
let muted = loadMuted();

function loadMuted() {
  try {
    return window.localStorage.getItem("mr-muted") === "1";
  } catch (e) {
    return false;
  }
}

/* Create/resume the audio context. Must be called from a user
   gesture (click) to satisfy autoplay policies. */
function unlock() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  } catch (e) {
    return false;
  }
}

/* ---------------- primitives ---------------- */

function noiseBuffer(seconds) {
  const rate = ctx.sampleRate;
  const buf = ctx.createBuffer(1, Math.floor(rate * seconds), rate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/* Sharp noise burst through a sweeping lowpass: the body of a gunshot. */
function burst(opts) {
  const t0 = ctx.currentTime + (opts.delay || 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(opts.dur || 0.25);

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(opts.startHz || 3800, t0);
  lp.frequency.exponentialRampToValueAtTime(opts.endHz || 300, t0 + (opts.dur || 0.25));

  const g = ctx.createGain();
  g.gain.setValueAtTime(opts.vol || 0.8, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + (opts.dur || 0.25));

  src.connect(lp).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + (opts.dur || 0.25) + 0.05);
}

/* Low sine thump: the punch of a round firing. */
function thump(freq, vol, delay, dur) {
  const t0 = ctx.currentTime + (delay || 0);
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(40, t0 + (dur || 0.18));
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + (dur || 0.18));
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + (dur || 0.18) + 0.05);
}

/* Tiny metallic ping: magazines and slides. */
function ping(freq, vol, delay) {
  const t0 = ctx.currentTime + (delay || 0);
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 3200;
  osc.connect(lp).connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + 0.08);
}

/* Short melodic note for win / fail stings. */
function note(freq, delay, dur, type, vol) {
  const t0 = ctx.currentTime + (delay || 0);
  const osc = ctx.createOscillator();
  osc.type = type || "triangle";
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol || 0.25, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/* ---------------- public SFX ---------------- */

function ready() { return unlock(); } // returns true if audio is usable

/* Player rifle: sharp crack with punch. */
function shot() {
  if (!ready()) return;
  burst({ dur: 0.22, vol: 0.75, startHz: 4200, endHz: 350 });
  thump(90, 0.5, 0, 0.16);
}

/* Enemy rifle: distant, more muffled. */
function enemyShot() {
  if (!ready()) return;
  burst({ dur: 0.3, vol: 0.4, startHz: 1600, endHz: 160, delay: 0.05 });
  thump(70, 0.3, 0.06, 0.2);
}

/* Reload cycle: mag out, mag in, slide rack. */
function reload() {
  if (!ready()) return;
  burst({ dur: 0.05, vol: 0.35, startHz: 2600, endHz: 900 });
  ping(1400, 0.12, 0.14);       // magazine seats
  burst({ dur: 0.07, vol: 0.4, startHz: 3000, endHz: 700, delay: 0.26 }); // slide
  ping(1900, 0.16, 0.3);
}

function stingWin() {
  if (!ready()) return;
  note(392, 0, 0.16, "triangle", 0.22);   // G4
  note(587, 0.14, 0.18, "triangle", 0.22); // D5
  note(784, 0.28, 0.4, "triangle", 0.22);  // G5
}

/* Distant jet flyby: a slow, quiet rumble that swells and fades. */
function jetFlyby() {
  if (!ready()) return;
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(3.2);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(320, t0);
  lp.frequency.linearRampToValueAtTime(900, t0 + 1.6);
  lp.frequency.linearRampToValueAtTime(300, t0 + 3.2);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, t0);
  g.gain.linearRampToValueAtTime(0.09, t0 + 1.5);
  g.gain.linearRampToValueAtTime(0.001, t0 + 3.2);
  src.connect(lp).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + 3.3);
  thump(48, 0.05, 0.6, 1.8);
}

function stingFail() {
  if (!ready()) return;
  note(110, 0, 0.5, "sawtooth", 0.18);
  note(82, 0.18, 0.6, "sawtooth", 0.16);
}

/* ---------------- mute ---------------- */

function setMuted(m) {
  muted = !!m;
  try {
    window.localStorage.setItem("mr-muted", muted ? "1" : "0");
  } catch (e) { /* storage unavailable — keep in-memory */ }
  if (master) master.gain.value = muted ? 0 : 1;
}

function getMuted() { return muted; }

window.MemoryRushAudio = {
  unlock, shot, enemyShot, reload, stingWin, stingFail, jetFlyby, setMuted, getMuted,
};
})();
