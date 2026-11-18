// Draws the painted cells as materials rather than tiles. For each element present, neighbouring
// cells are merged into one soft blob (rounded outer corners, little bumps along open edges),
// filled and detailed with that element's look (flames, cracked lava, rippling water, ice
// facets, mossy rock...), given a bright rim, and lit with additive glow on the floor around it.
// Each element is built on its own offscreen layer so the details stay inside the blob.
import { CELL, COLS, FIELD, ROWS } from './config.js';
import { CHARGED, CLOUD, EARTH, ELEMENTS, FIRE, ICE, LAVA, MAGNET, STEAM, STORM, WATER } from './elements.js';
import { drawGlyph } from './glyphs.js';

const layers = new Map();
const glows = new Map();
const lists = [];
for (let t = 0; t < 11; t += 1) lists.push([]);

const hash = (i, k) => {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

function layerFor(type) {
  let layer = layers.get(type);
  if (!layer) {
    layer = document.createElement('canvas');
    layer.width = FIELD.w;
    layer.height = FIELD.h;
    layers.set(type, layer);
  }
  return layer;
}

function glowFor(color) {
  let sprite = glows.get(color);
  if (!sprite) {
    sprite = document.createElement('canvas');
    sprite.width = 64;
    sprite.height = 64;
    const g = sprite.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    glows.set(color, sprite);
  }
  return sprite;
}

/** A jagged bolt from (x1, y1) to (x2, y2), drawn as a wide soft stroke plus a white core. */
export function drawZigzag(ctx, x1, y1, x2, y2, seed, color, width = 2) {
  const n = Math.max(3, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 9));
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const amp = i === 0 || i === n ? 0 : 7;
    pts.push([x1 + (x2 - x1) * t + (hash(seed, i) - 0.5) * 2 * amp, y1 + (y2 - y1) * t + (hash(seed, i + 40) - 0.5) * 2 * amp]);
  }
  for (const [c, w, a] of [[color, width * 3.2, 0.3], ['#ffffff', width, 0.95]]) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.globalAlpha = a;
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

const TAU = Math.PI * 2;
const masks = new Map();
let scratch = null;
let darkened = null;

function newCanvas() {
  const c = document.createElement('canvas');
  c.width = FIELD.w;
  c.height = FIELD.h;
  return c;
}

/**
 * Build (or reuse) the smooth blob mask for one element: every cell becomes a blurred circle, an
 * SVG alpha threshold turns the blurred union into a smooth, curved outline (no stair-steps), and
 * a dark outline and a pale rim light are derived from it. Rebuilt only when the cells change.
 */
function maskFor(type, cells, time) {
  let entry = masks.get(type);
  if (!entry) {
    entry = { sig: '', builtAt: -9, mask: newCanvas(), outline: newCanvas(), rim: newCanvas(), shade: newCanvas() };
    masks.set(type, entry);
  }
  let hashed = 0;
  for (const i of cells) hashed = (hashed * 31 + i) | 0;
  const sig = `${cells.length}:${hashed}`;
  if (entry.sig === sig || (entry.sig !== '' && time - entry.builtAt < 0.08)) return entry;
  entry.sig = sig;
  entry.builtAt = time;
  scratch ??= newCanvas();
  darkened ??= newCanvas();
  const sg = scratch.getContext('2d');
  sg.clearRect(0, 0, FIELD.w, FIELD.h);
  sg.filter = 'blur(5px)';
  sg.fillStyle = '#ffffff';
  sg.beginPath();
  for (const i of cells) {
    const cx = (i % COLS) * CELL + 10;
    const cy = Math.floor(i / COLS) * CELL + 10;
    sg.moveTo(cx + 12.5, cy);
    sg.arc(cx, cy, 12.5, 0, TAU);
  }
  sg.fill();
  sg.filter = 'none';
  const m = entry.mask.getContext('2d');
  m.clearRect(0, 0, FIELD.w, FIELD.h);
  m.filter = 'url(#cf-thresh)';
  m.drawImage(scratch, 0, 0);
  m.filter = 'none';
  // Near-black silhouette of the mask, stamped around it for a crisp outline.
  const d = darkened.getContext('2d');
  d.globalCompositeOperation = 'source-over';
  d.clearRect(0, 0, FIELD.w, FIELD.h);
  d.drawImage(entry.mask, 0, 0);
  d.globalCompositeOperation = 'source-in';
  d.fillStyle = '#05060a';
  d.fillRect(0, 0, FIELD.w, FIELD.h);
  d.globalCompositeOperation = 'source-over';
  const o = entry.outline.getContext('2d');
  o.clearRect(0, 0, FIELD.w, FIELD.h);
  if (type === ICE) {
    o.shadowColor = 'rgba(168,230,255,0.8)';
    o.shadowBlur = 14;
    o.drawImage(entry.mask, 0, 0);
    o.shadowBlur = 0;
    o.shadowColor = 'transparent';
  }
  if (type === EARTH) {
    o.globalAlpha = 0.5;
    o.drawImage(darkened, 3, 6);
    o.globalAlpha = 1;
  }
  for (let k = 0; k < 8; k += 1) o.drawImage(darkened, Math.cos((k / 8) * TAU) * 2.8, Math.sin((k / 8) * TAU) * 2.8);
  const r = entry.rim.getContext('2d');
  r.globalCompositeOperation = 'source-over';
  r.clearRect(0, 0, FIELD.w, FIELD.h);
  r.drawImage(entry.mask, 0, 0);
  r.globalCompositeOperation = 'destination-out';
  r.drawImage(entry.mask, 3, 3);
  r.globalCompositeOperation = 'source-in';
  r.fillStyle = RIMS[type];
  r.fillRect(0, 0, FIELD.w, FIELD.h);
  r.globalCompositeOperation = 'source-over';
  // Shadow side: the silhouette minus itself shifted up-left leaves the bottom-right edge.
  const sh = entry.shade.getContext('2d');
  sh.globalCompositeOperation = 'source-over';
  sh.clearRect(0, 0, FIELD.w, FIELD.h);
  sh.drawImage(entry.mask, 0, 0);
  sh.globalCompositeOperation = 'destination-out';
  sh.drawImage(entry.mask, -3, -3);
  sh.globalCompositeOperation = 'source-in';
  sh.fillStyle = '#02030a';
  sh.fillRect(0, 0, FIELD.w, FIELD.h);
  sh.globalCompositeOperation = 'source-over';
  return entry;
}

const ICE_TONES = ['#f2fdff', '#c9ecfb', '#9bd6f2', '#69b0de', '#dff6ff', '#7cc3ea', '#4f8fc8', '#ffffff'];
const BASES = { [FIRE]: '#c2300a', [LAVA]: '#2b0e08', [WATER]: '#0b6aa8', [CHARGED]: '#1590c4', [ICE]: '#6fb8e0', [EARTH]: '#5d4528', [STORM]: '#1a2850', [MAGNET]: '#26222c', [CLOUD]: '#2a3350' };
const RIMS = { [FIRE]: '#ffd24a', [LAVA]: '#ff8a2a', [WATER]: '#bff2ff', [CHARGED]: '#ffffff', [ICE]: '#ffffff', [EARTH]: '#b09258', [STORM]: '#ffe23a', [MAGNET]: '#c9ccd8', [CLOUD]: '#b9a8ff' };

/** Per-element detail painting, in layer coordinates, clipped to the blob by source-atop. */
/** Extra surface detail drawn on top of DETAILS (clipped to the blob afterwards). */
const EXTRAS = {
  [LAVA](g, cells, t) {
    g.globalCompositeOperation = 'lighter';
    for (const i of cells) {
      const x = (i % COLS) * CELL;
      const y = Math.floor(i / COLS) * CELL;
      const h = hash(i, 8);
      g.fillStyle = `rgba(255,150,40,${0.1 + 0.07 * Math.sin(t * 2.4 + h * 9)})`;
      g.beginPath();
      g.arc(x + 10 + Math.sin(t * 0.9 + h * 7) * 4, y + 10 + Math.cos(t * 0.8 + h * 5) * 4, 7, 0, TAU);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  },
  [WATER](g, cells, t) {
    waterExtras(g, cells, t, 'rgba(235,250,255,');
  },
  [CHARGED](g, cells, t) {
    waterExtras(g, cells, t, 'rgba(210,255,255,');
  },
  [ICE](g, cells, t) {
    for (const i of cells) {
      const h = hash(i, 11);
      if (h < 0.55) continue;
      const x = (i % COLS) * CELL + 4 + hash(i, 12) * 12;
      const y = Math.floor(i / COLS) * CELL + 4 + hash(i, 13) * 12;
      const glint = Math.max(0, Math.sin(t * 2.2 + h * 20)) ** 5;
      if (glint < 0.05) continue;
      g.strokeStyle = `rgba(255,255,255,${glint})`;
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(x - 5 * glint - 1, y);
      g.lineTo(x + 5 * glint + 1, y);
      g.moveTo(x, y - 5 * glint - 1);
      g.lineTo(x, y + 5 * glint + 1);
      g.stroke();
    }
  },
  [MAGNET](g, cells, t) {
    for (const i of cells) {
      const x = (i % COLS) * CELL;
      const y = Math.floor(i / COLS) * CELL;
      const band = Math.max(0, Math.sin((x + y) * 0.045 - t * 1.6)) ** 6;
      if (band < 0.03) continue;
      g.fillStyle = `rgba(230,235,255,${0.32 * band})`;
      g.fillRect(x, y, CELL, CELL);
    }
  },
  [EARTH](g, cells) {
    for (const i of cells) {
      const h = hash(i, 21);
      if (h < 0.55) continue;
      const x = (i % COLS) * CELL;
      const y = Math.floor(i / COLS) * CELL;
      g.fillStyle = `rgba(${70 + (h * 40) | 0},${120 + (h * 40) | 0},48,0.6)`;
      g.beginPath();
      g.ellipse(x + 6 + hash(i, 22) * 8, y + 4 + hash(i, 23) * 4, 5, 2.6, 0, 0, TAU);
      g.fill();
    }
  },
};

/** Layered caustic ripples and foam on the edge cells of a pool. */
function waterExtras(g, cells, t, white) {
  const set = new Set(cells);
  for (const i of cells) {
    const x = (i % COLS) * CELL;
    const y = Math.floor(i / COLS) * CELL;
    const h = hash(i, 31);
    g.strokeStyle = `${white}${0.1 + 0.08 * Math.sin(t * 1.7 + h * 9)})`;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x + 2, y + 6 + Math.sin(t * 1.3 + h * 6) * 2);
    g.quadraticCurveTo(x + 10, y + 1 + Math.sin(t * 1.9 + h * 4) * 2, x + 18, y + 7);
    g.moveTo(x + 1, y + 15 + Math.cos(t * 1.5 + h * 3) * 2);
    g.quadraticCurveTo(x + 9, y + 11, x + 19, y + 16);
    g.stroke();
    const col = i % COLS;
    const edge = !set.has(i - COLS) || !set.has(i + COLS) || (col > 0 && !set.has(i - 1)) || (col < COLS - 1 && !set.has(i + 1));
    if (edge) {
      g.fillStyle = `${white}${0.45 + 0.2 * Math.sin(t * 3 + h * 12)})`;
      for (let k = 0; k < 3; k += 1) {
        g.beginPath();
        g.arc(x + 3 + k * 7 + hash(i, 40 + k) * 4, y + (k % 2 ? 3 : 17), 1.6 + hash(i, 50 + k) * 1.4, 0, TAU);
        g.fill();
      }
    }
  }
}

const DETAILS = {
  [FIRE](g, cells, t) {
    for (const i of cells) {
      const x = (i % COLS) * CELL;
      const y = Math.floor(i / COLS) * CELL;
      for (let k = 0; k < 3; k += 1) {
        const h = hash(i, k);
        const bx = x + 3 + k * 6.5;
        const lick = Math.sin(t * 11 + h * 20 + k) * 3;
        const tip = y + 1 - 3 * h + Math.sin(t * 9 + h * 9) * 2;
        g.fillStyle = '#ff7a1a';
        g.beginPath();
        g.moveTo(bx - 4, y + CELL);
        g.quadraticCurveTo(bx - 3 + lick, y + 9, bx + lick, tip);
        g.quadraticCurveTo(bx + 3 + lick, y + 9, bx + 4, y + CELL);
        g.fill();
        g.fillStyle = '#ffe27a';
        g.beginPath();
        g.moveTo(bx - 2, y + CELL);
        g.quadraticCurveTo(bx - 1 + lick * 0.6, y + 12, bx + lick * 0.6, tip + 7);
        g.quadraticCurveTo(bx + 1 + lick * 0.6, y + 12, bx + 2, y + CELL);
        g.fill();
      }
    }
  },
  [LAVA](g, cells, t) {
    for (const i of cells) {
      const x = (i % COLS) * CELL;
      const y = Math.floor(i / COLS) * CELL;
      const pulse = 0.55 + 0.45 * Math.sin(t * 1.8 + hash(i, 1) * 6.28);
      g.fillStyle = '#ff6a14';
      g.globalAlpha = 0.35 + 0.25 * pulse;
      g.fillRect(x, y, CELL, CELL);
      g.globalAlpha = 1;
      g.strokeStyle = `rgba(255,${150 + 80 * pulse | 0},40,${0.65 + 0.35 * pulse})`;
      g.lineWidth = 2.4;
      g.lineCap = 'round';
      g.beginPath();
      const flow = Math.sin(t * 0.7 + hash(i, 2) * 6) * 2;
      g.moveTo(x + 1, y + 4 + hash(i, 3) * 12);
      g.lineTo(x + 7 + flow, y + 8 + hash(i, 4) * 6);
      g.lineTo(x + 12, y + 3 + hash(i, 5) * 12 - flow);
      g.lineTo(x + CELL - 1, y + 7 + hash(i, 6) * 8);
      g.moveTo(x + 8 + flow, y + 8 + hash(i, 4) * 6);
      g.lineTo(x + 9, y + CELL - 2);
      g.stroke();
      g.fillStyle = '#2f1209';
      g.beginPath();
      g.moveTo(x + 2 + hash(i, 7) * 4, y + 2);
      g.lineTo(x + 9, y + 4);
      g.lineTo(x + 6, y + 9);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(x + 12, y + 12);
      g.lineTo(x + 18, y + 11);
      g.lineTo(x + 16, y + 18);
      g.closePath();
      g.fill();
    }
  },
  [WATER](g, cells, t) {
    ripples(g, cells, t, 'rgba(170,236,255,0.7)');
  },
  [CHARGED](g, cells, t) {
    ripples(g, cells, t * 2, 'rgba(230,250,255,0.9)');
  },
  [ICE](g, cells) {
    // Big overlapping crystal facets, each a jittered polygon in one of several light and dark
    // blue-white tones, centred on a scattering of cells: no cell-sized repetition shows through.
    for (const pass of [0, 1]) {
      for (const i of cells) {
        if (hash(i, 1) < (pass ? 0.72 : 0.42)) continue;
        const x = (i % COLS) * CELL + 10 + (hash(i, 11) - 0.5) * 14;
        const y = Math.floor(i / COLS) * CELL + 10 + (hash(i, 12) - 0.5) * 14;
        const n = 3 + ((hash(i, 2) * 3) | 0);
        const rad = (pass ? 9 : 16) + hash(i, 3) * (pass ? 12 : 22);
        const rot = hash(i, 4) * 6.283;
        const pts = [];
        for (let k = 0; k < n; k += 1) {
          const ang = rot + (k / n) * 6.283 + (hash(i, 10 + k) - 0.5) * 0.9;
          const rr = rad * (0.5 + hash(i, 20 + k) * 0.7);
          pts.push([x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.8]);
        }
        g.beginPath();
        pts.forEach((pt, k) => (k === 0 ? g.moveTo(pt[0], pt[1]) : g.lineTo(pt[0], pt[1])));
        g.closePath();
        g.fillStyle = ICE_TONES[(hash(i, 5) * ICE_TONES.length) | 0];
        g.fill();
        g.strokeStyle = 'rgba(40,90,150,0.45)';
        g.lineWidth = 1.2;
        g.stroke();
        g.strokeStyle = '#ffffff';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        g.lineTo(pts[1][0], pts[1][1]);
        g.stroke();
      }
    }
  },
  [EARTH](g, cells) {
    for (const i of cells) {
      const x = (i % COLS) * CELL;
      const y = Math.floor(i / COLS) * CELL;
      g.fillStyle = '#8a6a3a';
      g.fillRect(x, y, CELL, 12);
      g.fillStyle = '#a88650';
      g.fillRect(x + 1, y + 1, CELL - 2, 3);
      g.fillStyle = '#3f2e18';
      g.fillRect(x, y + 12, CELL, 8);
      g.fillStyle = '#6aa23a';
      g.beginPath();
      g.arc(x + 4 + hash(i, 1) * 10, y + 2, 4 + hash(i, 2) * 3, 0, 6.283);
      g.fill();
      g.strokeStyle = 'rgba(30,20,8,0.7)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x + 4 + hash(i, 3) * 8, y + 5);
      g.lineTo(x + 8 + hash(i, 4) * 8, y + 17);
      g.stroke();
    }
  },
  [STORM](g, cells, t) {
    for (const i of cells) {
      const x = (i % COLS) * CELL;
      const y = Math.floor(i / COLS) * CELL;
      g.fillStyle = `rgba(90,140,255,${0.4 + 0.3 * Math.sin(t * 8 + i)})`;
      g.fillRect(x, y, CELL, CELL);
      g.strokeStyle = '#ffe23a';
      g.lineWidth = 2.6;
      g.beginPath();
      const j = Math.sin(t * 20 + i) * 2;
      g.moveTo(x + 7, y + 1);
      g.lineTo(x + 12 + j, y + 8);
      g.lineTo(x + 7, y + 11);
      g.lineTo(x + 13 - j, y + CELL - 1);
      g.stroke();
    }
  },
  [MAGNET](g, cells, t) {
    for (const i of cells) {
      const x = (i % COLS) * CELL;
      const y = Math.floor(i / COLS) * CELL;
      const sheen = g.createLinearGradient(x, y, x + CELL, y + CELL);
      sheen.addColorStop(0, '#6a6674');
      sheen.addColorStop(0.5, '#2e2a36');
      sheen.addColorStop(1, '#17141c');
      g.fillStyle = sheen;
      g.fillRect(x, y, CELL, CELL);
      g.fillStyle = '#d0d3e0';
      for (let k = 0; k < 3; k += 1) g.fillRect(x + 2 + hash(i, k) * 15, y + 2 + hash(i, k + 5) * 15, 2, 2);
      g.fillStyle = '#0c0a10';
      g.fillRect(x + 3 + hash(i, 9) * 10, y + 8 + hash(i, 10) * 8, 5, 3);
      g.strokeStyle = `rgba(255,${90 + 60 * Math.sin(t * 2 + i)},120,0.6)`;
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(x + 10, y + 10, 6, t * 2 + hash(i, 1) * 6, t * 2 + hash(i, 1) * 6 + 2.4);
      g.stroke();
    }
  },
  [CLOUD](g, cells, t) {
    for (const i of cells) {
      const x = (i % COLS) * CELL;
      const y = Math.floor(i / COLS) * CELL;
      g.fillStyle = 'rgba(160,175,215,0.55)';
      g.beginPath();
      g.arc(x + 6 + Math.sin(t + i) * 2, y + 8, 6, 0, 6.283);
      g.arc(x + 14, y + 11 - Math.sin(t * 1.3 + i) * 2, 7, 0, 6.283);
      g.fill();
    }
  },
};

function ripples(g, cells, t, color) {
  g.strokeStyle = color;
  g.lineWidth = 1.6;
  g.lineCap = 'round';
  g.beginPath();
  for (const i of cells) {
    const x = (i % COLS) * CELL;
    const y = Math.floor(i / COLS) * CELL;
    for (let k = 0; k < 2; k += 1) {
      const yy = y + 5 + k * 9 + Math.sin(t * 1.5 + hash(i, k) * 6) * 1.5;
      g.moveTo(x + 1, yy);
      g.quadraticCurveTo(x + 5, yy - 3 + Math.sin(t * 2 + i) * 1.5, x + 10, yy);
      g.quadraticCurveTo(x + 15, yy + 3, x + CELL - 1, yy - 1);
    }
  }
  g.stroke();
}

const ETCH = { [FIRE]: 'fire', [LAVA]: 'fire', [WATER]: 'water', [CHARGED]: 'water', [EARTH]: 'earth', [MAGNET]: 'earth', [STORM]: 'storm', [CLOUD]: 'storm', [ICE]: 'frost' };

/** Faint alchemical glyphs etched into the interior of a blob, one every few cells. */
function etchGlyphs(g, grid, type, cells) {
  const kind = ETCH[type];
  if (!kind) return;
  for (const i of cells) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    if ((col + row * 2) % 4 !== 0 || col < 1 || col > COLS - 2 || row < 1 || row > ROWS - 2) continue;
    if (grid.type[i - 1] !== type || grid.type[i + 1] !== type || grid.type[i - COLS] !== type || grid.type[i + COLS] !== type) continue;
    drawGlyph(g, kind, col * CELL + 10, row * CELL + 10, 6.5, 'rgba(255,255,255,0.3)', 1.6);
  }
}

const GLOW = {
  [FIRE]: ['#ff8a2a', 0.55, 78],
  [LAVA]: ['#ff6a14', 0.6, 84],
  [STORM]: ['#8fb0ff', 0.5, 74],
  [CHARGED]: ['#6fe8ff', 0.5, 74],
  [CLOUD]: ['#7f98d8', 0.3, 64],
  [MAGNET]: ['#b9a8ff', 0.08, 50],
  [ICE]: ['#a8e6ff', 0.2, 60],
  [WATER]: ['#22a8ff', 0.12, 56],
};

/** Steam: drifting translucent puffs, drawn straight onto the battlefield. */
function drawSteam(ctx, cells, t) {
  const puff = glowFor('rgba(235,246,252,0.95)');
  for (const i of cells) {
    const x = FIELD.x + (i % COLS) * CELL;
    const y = FIELD.y + Math.floor(i / COLS) * CELL;
    for (let k = 0; k < 2; k += 1) {
      const h = hash(i, k + 10);
      const rise = (t * 9 + h * 30) % 26;
      ctx.globalAlpha = 0.3 * (1 - rise / 26);
      const r = 17 + h * 8 + rise * 0.3;
      ctx.drawImage(puff, x + 10 + Math.sin(t * 0.9 + h * 6) * 7 - r, y + 10 - rise - r, r * 2, r * 2);
    }
  }
  ctx.globalAlpha = 1;
}

/** Forked lightning striking down from stormcloud cells, and arcs jumping across charged water. */
function drawBolts(ctx, cloud, charged, t) {
  ctx.globalCompositeOperation = 'lighter';
  for (const i of cloud) {
    const phase = (t * 1.4 + hash(i, 9) * 9) % 3;
    if (phase > 0.28) continue;
    const x = FIELD.x + (i % COLS) * CELL + 10;
    const y = FIELD.y + Math.floor(i / COLS) * CELL + 14;
    const seed = i * 7 + Math.floor(t * 18);
    drawZigzag(ctx, x, y, x + (hash(i, 11) - 0.5) * 50, y + 60 + hash(i, 12) * 50, seed, '#c58aff', 2.2);
    drawZigzag(ctx, x + 4, y + 30, x + 36, y + 70, seed + 3, '#c58aff', 1.4);
  }
  if (charged.length > 1) {
    const step = Math.floor(t * 12);
    const n = Math.min(6, 1 + (charged.length >> 3));
    for (let k = 0; k < n; k += 1) {
      const a = charged[(hash(step, k) * charged.length) | 0];
      const b = charged[(hash(step, k + 20) * charged.length) | 0];
      const ax = FIELD.x + (a % COLS) * CELL + 10;
      const ay = FIELD.y + Math.floor(a / COLS) * CELL + 10;
      const bx = FIELD.x + (b % COLS) * CELL + 10;
      const by = FIELD.y + Math.floor(b / COLS) * CELL + 10;
      if (Math.hypot(ax - bx, ay - by) < 130) drawZigzag(ctx, ax, ay, bx, by, step * 31 + k, '#b27cff', 1.6);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** Tall spikes along the top edge of an ice field, and twinkling frost sparkles on it. */
function drawIceExtras(ctx, grid, cells, t) {
  for (const i of cells) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = FIELD.x + col * CELL;
    const y = FIELD.y + row * CELL;
    if (row > 0 && grid.type[i - COLS] === ICE) continue;
    if (hash(i, 30) < 0.62) continue;
    const h = 22 + hash(i, 31) * 34;
    const lean = (hash(i, 32) - 0.5) * 16;
    const grad = ctx.createLinearGradient(x, y, x, y - h);
    grad.addColorStop(0, '#5fa8d8');
    grad.addColorStop(1, '#ffffff');
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 3);
    ctx.lineTo(x + 10 + lean, y - h);
    ctx.lineTo(x + 18, y + 3);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#2c5f93';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x + 4, y);
    ctx.lineTo(x + 10 + lean, y - h);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const i of cells) {
    if (hash(i, 40) < 0.86) continue;
    const tw = Math.sin(t * 3 + hash(i, 41) * 9);
    if (tw < 0.1) continue;
    const x = FIELD.x + (i % COLS) * CELL + 4 + hash(i, 42) * 12;
    const y = FIELD.y + Math.floor(i / COLS) * CELL + 4 + hash(i, 43) * 12;
    const r = 3 + tw * 6;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x, y - r * 0.18);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r * 0.18);
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.18, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r * 0.18, y);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** Swirling field lines spiralling in toward a magnetite cluster, pulling whatever stands near it. */
function drawFieldLines(ctx, cells, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 2.2;
  ctx.setLineDash([9, 7]);
  ctx.lineDashOffset = t * 26;
  cells.forEach((i, n) => {
    if (n % 3 !== 0) return;
    const cx = FIELD.x + (i % COLS) * CELL + 10;
    const cy = FIELD.y + Math.floor(i / COLS) * CELL + 10;
    [['rgba(190,160,255,0.55)', 0], ['rgba(140,190,255,0.55)', Math.PI]].forEach(([color, phase]) => {
      ctx.strokeStyle = color;
      ctx.beginPath();
      for (let a = 0; a < 7.5; a += 0.25) {
        const r = 78 - 60 * (a / 7.5);
        const px = cx + Math.cos(a + phase) * r;
        const py = cy + Math.sin(a + phase) * r * 0.85;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    });
  });
  ctx.restore();
}

/** Paint every painted cell of the grid as materials. `time` is seconds, for the animation. */
export function drawMaterials(ctx, game, time) {
  const grid = game.grid;
  for (const list of lists) list.length = 0;
  for (let i = 0; i < grid.type.length; i += 1) if (grid.type[i] !== 0) lists[grid.type[i]].push(i);

  // Ground-hugging glow first, so every material sits in its own light.
  ctx.globalCompositeOperation = 'lighter';
  for (const type of [FIRE, LAVA, STORM, CHARGED, CLOUD, MAGNET, ICE, WATER]) {
    const [color, alpha, size] = GLOW[type];
    ctx.globalAlpha = alpha;
    const sprite = glowFor(color);
    for (const i of lists[type]) ctx.drawImage(sprite, FIELD.x + (i % COLS) * CELL + 10 - size / 2, FIELD.y + Math.floor(i / COLS) * CELL + 10 - size / 2, size, size);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  for (const type of [WATER, CHARGED, ICE, EARTH, MAGNET, LAVA, FIRE, STORM, CLOUD]) {
    const cells = lists[type];
    if (cells.length === 0) continue;
    const entry = maskFor(type, cells, time);
    ctx.drawImage(entry.outline, FIELD.x, FIELD.y);
    const layer = layerFor(type);
    const g = layer.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, FIELD.w, FIELD.h);
    g.fillStyle = BASES[type];
    g.fillRect(0, 0, FIELD.w, FIELD.h);
    DETAILS[type](g, cells, time);
    EXTRAS[type]?.(g, cells, time);
    etchGlyphs(g, grid, type, cells);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(entry.mask, 0, 0);
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(layer, FIELD.x, FIELD.y);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(entry.rim, FIELD.x, FIELD.y);
    ctx.globalAlpha = 0.3;
    ctx.drawImage(entry.shade, FIELD.x, FIELD.y);
    ctx.globalAlpha = 1;
    if (type === ICE) drawIceExtras(ctx, grid, cells, time);
    if (type === MAGNET) drawFieldLines(ctx, cells, time);
  }

  // Cells about to expire blink, so the player sees what is fading.
  ctx.fillStyle = 'rgba(5,6,10,0.55)';
  for (let i = 0; i < grid.type.length; i += 1) {
    if (grid.type[i] !== 0 && grid.life[i] < 1.2 && Math.sin(time * 26) > 0.2) {
      ctx.fillRect(FIELD.x + (i % COLS) * CELL, FIELD.y + Math.floor(i / COLS) * CELL, CELL, CELL);
    }
  }

  drawSteam(ctx, lists[STEAM], time);
  drawBolts(ctx, lists[CLOUD], lists[CHARGED], time);
}
