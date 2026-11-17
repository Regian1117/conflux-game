// The battlefield floor: a textured obsidian plain with stone plates, cracks, faint glowing
// mineral veins, rubble, scorch marks, a rune ring round the Core and a vignette. It is painted
// once, with a fixed seed, onto an offscreen canvas and then just blitted every frame.
import { CELL, COLS, CORE, FIELD, GATES, ROWS } from './config.js';
import { createRandom } from './random.js';

let ground = null;
let gridLines = null;

function polygon(g, points) {
  g.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
  g.closePath();
}

function stonePlates(g, rng) {
  for (let n = 0; n < 300; n += 1) {
    const cx = rng.range(0, FIELD.w);
    const cy = rng.range(0, FIELD.h);
    const s = rng.range(26, 90);
    const pts = [0, 1, 2, 3, 4].map((k) => {
      const a = (k / 5) * 6.283 + rng.range(-0.4, 0.4);
      return [cx + Math.cos(a) * s * rng.range(0.6, 1.1), cy + Math.sin(a) * s * rng.range(0.5, 0.9)];
    });
    const light = rng.range(9, 19);
    polygon(g, pts);
    g.fillStyle = `hsla(${rng.range(215, 250)}, 18%, ${light}%, 0.55)`;
    g.fill();
    g.strokeStyle = 'rgba(2,3,6,0.7)';
    g.lineWidth = 2;
    g.stroke();
    g.strokeStyle = 'rgba(120,130,170,0.07)';
    g.lineWidth = 1;
    g.stroke();
  }
}

function speckle(g, rng) {
  for (let n = 0; n < 9000; n += 1) {
    g.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.18)';
    g.fillRect(rng.range(0, FIELD.w), rng.range(0, FIELD.h), rng.range(1, 3), rng.range(1, 3));
  }
}

function walk(g, rng, x, y, steps, step, jitter) {
  g.moveTo(x, y);
  let a = rng.range(0, 6.283);
  for (let i = 0; i < steps; i += 1) {
    a += rng.range(-jitter, jitter);
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    g.lineTo(x, y);
  }
}

function cracks(g, rng) {
  for (let n = 0; n < 70; n += 1) {
    const x = rng.range(0, FIELD.w);
    const y = rng.range(0, FIELD.h);
    const seed = rng.int(1e9);
    for (const [color, width, off] of [['rgba(0,0,0,0.85)', 2.6, 0], ['rgba(110,120,160,0.18)', 1, 1.5]]) {
      const local = createRandom(seed);
      g.beginPath();
      walk(g, local, x + off, y + off, 6 + (n % 9), 11, 0.9);
      g.strokeStyle = color;
      g.lineWidth = width;
      g.stroke();
    }
  }
}

function veins(g, rng) {
  g.globalCompositeOperation = 'lighter';
  const colors = ['#6a3fd0', '#1d8aa8', '#c2501a', '#3f6ad0'];
  for (let n = 0; n < 26; n += 1) {
    const x = rng.range(0, FIELD.w);
    const y = rng.range(0, FIELD.h);
    const seed = rng.int(1e9);
    const color = colors[n % colors.length];
    for (const [width, alpha] of [[6, 0.07], [2.2, 0.32], [0.9, 0.7]]) {
      const local = createRandom(seed);
      g.beginPath();
      walk(g, local, x, y, 9 + (n % 8), 12, 0.7);
      g.strokeStyle = color;
      g.globalAlpha = alpha;
      g.lineWidth = width;
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

function rubble(g, rng) {
  for (let n = 0; n < 260; n += 1) {
    const x = rng.range(4, FIELD.w - 4);
    const y = rng.range(4, FIELD.h - 4);
    const s = rng.range(2, 6);
    const pts = [0, 1, 2, 3].map((k) => [x + Math.cos(k * 1.57 + rng.range(-0.5, 0.5)) * s, y + Math.sin(k * 1.57 + rng.range(-0.5, 0.5)) * s * 0.8]);
    polygon(g, pts.map(([px, py]) => [px + 1.5, py + 2]));
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fill();
    polygon(g, pts);
    g.fillStyle = `hsl(${rng.range(210, 240)}, 12%, ${rng.range(18, 32)}%)`;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 1;
    g.stroke();
  }
}

function scorches(g, rng) {
  for (let n = 0; n < 22; n += 1) {
    const x = rng.range(0, FIELD.w);
    const y = rng.range(0, FIELD.h);
    const r = rng.range(20, 62);
    const grad = g.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, 'rgba(0,0,0,0.65)');
    grad.addColorStop(0.7, 'rgba(8,4,4,0.35)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/** Rune rings round the Core and burnt, cracked landings at each rift gate. */
function landmarks(g) {
  const cx = (CORE.col + 0.5) * CELL;
  const cy = (CORE.row + 0.5) * CELL;
  g.globalCompositeOperation = 'lighter';
  for (const [r, a, w] of [[78, 0.35, 2], [64, 0.2, 1], [96, 0.14, 1]]) {
    g.strokeStyle = `rgba(111,240,255,${a})`;
    g.lineWidth = w;
    g.beginPath();
    g.arc(cx, cy, r, 0, 6.283);
    g.stroke();
  }
  for (let k = 0; k < 24; k += 1) {
    const a = (k / 24) * 6.283;
    g.strokeStyle = 'rgba(111,240,255,0.25)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy, 87, a, a + 0.1);
    g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
  for (const gate of Object.values(GATES)) {
    const x = (gate.col + 0.5) * CELL;
    const y = (gate.row + 0.5) * CELL;
    const grad = g.createRadialGradient(x, y, 4, x, y, 90);
    grad.addColorStop(0, 'rgba(60,10,90,0.6)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - 90, y - 90, 180, 180);
  }
}

function vignette(g) {
  const grad = g.createRadialGradient(FIELD.w / 2, FIELD.h / 2, FIELD.h * 0.35, FIELD.w / 2, FIELD.h / 2, FIELD.w * 0.62);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.7)');
  g.fillStyle = grad;
  g.fillRect(0, 0, FIELD.w, FIELD.h);
}

/** The cached floor, FIELD.w x FIELD.h pixels, painted on first use. */
export function getGround() {
  if (ground) return ground;
  ground = document.createElement('canvas');
  ground.width = FIELD.w;
  ground.height = FIELD.h;
  const g = ground.getContext('2d');
  const rng = createRandom(20260117);
  const base = g.createLinearGradient(0, 0, FIELD.w, FIELD.h);
  base.addColorStop(0, '#12151f');
  base.addColorStop(1, '#0a0c13');
  g.fillStyle = base;
  g.fillRect(0, 0, FIELD.w, FIELD.h);
  stonePlates(g, rng);
  speckle(g, rng);
  scorches(g, rng);
  cracks(g, rng);
  veins(g, rng);
  rubble(g, rng);
  landmarks(g);
  vignette(g);
  return ground;
}

/** A faint cell grid, drawn over the floor (brighter while the player is painting). */
export function getGridLines() {
  if (gridLines) return gridLines;
  gridLines = document.createElement('canvas');
  gridLines.width = FIELD.w;
  gridLines.height = FIELD.h;
  const g = gridLines.getContext('2d');
  g.strokeStyle = '#9fb3ff';
  g.lineWidth = 1;
  g.beginPath();
  for (let c = 0; c <= COLS; c += 1) {
    g.moveTo(c * CELL + 0.5, 0);
    g.lineTo(c * CELL + 0.5, FIELD.h);
  }
  for (let r = 0; r <= ROWS; r += 1) {
    g.moveTo(0, r * CELL + 0.5);
    g.lineTo(FIELD.w, r * CELL + 0.5);
  }
  g.stroke();
  return gridLines;
}
