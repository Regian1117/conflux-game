// All sound is generated live with WebAudio: short synthesized effects and a light procedural
// tune (bass + arpeggio + a boss pulse). Nothing is loaded. Safe to import where there is no
// AudioContext (the screenshot mode and tests): every call then does nothing.
let ctx = null;
let master = null;
let muted = false;
const lastPlayed = new Map();
let nextBeat = 0;
let beatIndex = 0;

/** Create the audio graph on the first user gesture (browsers refuse to before one). */
export function unlockAudio() {
  if (!ctx && typeof AudioContext !== 'undefined') {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.45;
    master.connect(ctx.destination);
    nextBeat = ctx.currentTime + 0.1;
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.45;
  return muted;
}

export const isMuted = () => muted;

/** One enveloped oscillator note. */
function tone(freq, dur, type = 'square', volume = 0.2, slideTo = 0, delay = 0, cutoff = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let tail = osc;
  if (cutoff) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    osc.connect(filter);
    tail = filter;
  }
  tail.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** A burst of filtered noise: hisses, crackles, thuds. */
function noise(dur, volume = 0.2, cutoff = 2000, type = 'lowpass', delay = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = cutoff;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(t0);
}

/** True when sound `name` may play now (each sound has a minimum gap so a chain does not scream). */
function ready(name, gap) {
  if (!ctx) return false;
  const now = ctx.currentTime;
  if (now - (lastPlayed.get(name) ?? -1) < gap) return false;
  lastPlayed.set(name, now);
  return true;
}

export const sfx = {
  paint(brush) {
    if (!ready('paint', 0.07)) return;
    const base = [180, 320, 110, 520][brush] ?? 200;
    tone(base * (1 + Math.random() * 0.12), 0.09, brush === 3 ? 'sawtooth' : 'triangle', 0.07, base * 1.3);
    if (brush === 0 || brush === 1) noise(0.08, 0.05, 2600, 'highpass');
  },
  react(name) {
    if (!ready('react', 0.06)) return;
    if (name === 'STEAM' || name === 'QUENCH') noise(0.5, 0.16, 5000, 'highpass');
    else if (name === 'LAVA') tone(90, 0.4, 'sawtooth', 0.14, 50, 0, 600);
    else if (name === 'SHOCK' || name === 'STORMSTEAM') {
      noise(0.25, 0.14, 4000, 'highpass');
      tone(900, 0.2, 'sawtooth', 0.1, 220);
    } else if (name === 'SHATTER') {
      noise(0.35, 0.2, 3000, 'highpass');
      tone(1400, 0.25, 'triangle', 0.12, 300);
    } else tone(300, 0.18, 'triangle', 0.12, 600);
  },
  chain(count) {
    if (!ready('chain', 0.18)) return;
    const step = Math.min(count, 12);
    tone(440 * 2 ** (step / 12), 0.22, 'square', 0.1, 0, 0, 3000);
    tone(660 * 2 ** (step / 12), 0.22, 'triangle', 0.08, 0, 0.05);
  },
  strike() {
    if (!ready('strike', 0.08)) return;
    noise(0.3, 0.22, 2500);
    tone(1200, 0.18, 'sawtooth', 0.12, 80);
  },
  kill(big) {
    if (!ready('kill', 0.05)) return;
    tone(big ? 130 : 260, 0.18, 'square', 0.12, big ? 50 : 120);
    noise(big ? 0.4 : 0.12, big ? 0.22 : 0.1, 1200);
  },
  coreHit() {
    noise(0.4, 0.28, 500);
    tone(110, 0.4, 'sawtooth', 0.2, 40);
  },
  plate() {
    noise(0.5, 0.25, 900);
    tone(200, 0.5, 'square', 0.18, 60);
    tone(800, 0.3, 'triangle', 0.1, 1600, 0.1);
  },
  boon() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.14, 0, i * 0.07));
  },
  riftOpen() {
    tone(70, 1.0, 'sawtooth', 0.2, 180, 0, 500);
    noise(0.9, 0.1, 800);
  },
  win() {
    [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.45, 'triangle', 0.16, 0, i * 0.12));
  },
  lose() {
    [392, 330, 262, 196, 131].forEach((f, i) => tone(f, 0.6, 'sawtooth', 0.14, f * 0.9, i * 0.22, 900));
  },
  click() {
    tone(660, 0.07, 'square', 0.08);
  },
};

const BASS = [55, 55, 43.65, 49];
const ARP = [220, 261.63, 329.63, 392, 329.63, 261.63, 293.66, 246.94];

/**
 * Keep the tune scheduled a little ahead of the clock. `intensity` runs 0 (title) to 1 (boss):
 * it adds the arpeggio, then the hat, then a faster pulse.
 */
export function updateMusic(intensity) {
  if (!ctx || muted) return;
  const beat = 0.25;
  while (nextBeat < ctx.currentTime + 0.25) {
    const i = beatIndex;
    const delay = Math.max(0, nextBeat - ctx.currentTime);
    if (i % 4 === 0) tone(BASS[(i >> 2) % BASS.length], beat * 3.6, 'triangle', 0.17, 0, delay);
    if (intensity > 0.15 && i % 2 === 0) tone(ARP[(i >> 1) % ARP.length], beat * 1.6, 'square', 0.045, 0, delay, 1600);
    if (intensity > 0.5 && i % 2 === 1) noise(0.04, 0.035, 7000, 'highpass', delay);
    if (intensity > 0.85 && i % 8 === 6) tone(ARP[(i + 3) % ARP.length] * 2, beat * 1.2, 'sawtooth', 0.04, 0, delay, 2500);
    beatIndex += 1;
    nextBeat += beat;
  }
}
