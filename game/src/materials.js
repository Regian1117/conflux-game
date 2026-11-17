// Draws the painted cells as materials rather than tiles. For each element present, neighbouring
// cells are merged into one soft blob (rounded outer corners, little bumps along open edges),
// filled and detailed with that element's look (flames, cracked lava, rippling water, ice
// facets, mossy rock...), given a bright rim, and lit with additive glow on the floor around it.
// Each element is built on its own offscreen layer so the details stay inside the blob.
import { CELL, COLS, FIELD, ROWS } from './config.js';
import { CHARGED, CLOUD, EARTH, ELEMENTS, FIRE, ICE, LAVA, MAGNET, STEAM, STORM, WATER } from './elements.js';

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

/** Add the blob outline for `cells` (cell indices of one type) to the current path. */
function traceBlob(g, grid, type, cells, dx, dy) {
  g.beginPath();
  for (const i of cells) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * CELL + dx;
    const y = row * CELL + dy;
    const l = col > 0 && grid.type[i - 1] === type;
    const r = col < COLS - 1 && grid.type[i + 1] === type;
    const u = row > 0 && grid.type[i - COLS] === type;
    const d = row < ROWS - 1 && grid.type[i + COLS] === type;
    const rad = 8 + hash(i, 3) * 3;
    g.roundRect(x - (l ? 0.5 : 1.5), y - (u ? 0.5 : 1.5), CELL + (l ? 0.5 : 1.5) + (r ? 0.5 : 1.5), CELL + (u ? 0.5 : 1.5) + (d ? 0.5 : 1.5), [!l && !u ? rad : 0, !r && !u ? rad : 0, !r && !d ? rad : 0, !l && !d ? rad : 0]);
    // Little bumps along open edges make the outline organic instead of boxy.
    if (!u && hash(i, 5) > 0.45) g.moveTo(x + 10 + 6, y - 1), g.arc(x + 10, y - 1, 6, 0, 6.283);
    if (!d && hash(i, 6) > 0.45) g.moveTo(x + 10 + 5, y + CELL + 1), g.arc(x + 10, y + CELL + 1, 5, 0, 6.283);
    if (!l && hash(i, 7) > 0.5) g.moveTo(x - 1 + 5, y + 10), g.arc(x - 1, y + 10, 5, 0, 6.283);
    if (!r && hash(i, 8) > 0.5) g.moveTo(x + CELL + 1 + 6, y + 10), g.arc(x + CELL + 1, y + 10, 6, 0, 6.283);
  }
}

/** The bright rim along every open edge of the blob (drawn inside it). */
function rim(g, grid, type, cells, color, width) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.beginPath();
  for (const i of cells) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * CELL;
    const y = row * CELL;
    if (!(col > 0 && grid.type[i - 1] === type)) g.moveTo(x + 1, y + 3), g.lineTo(x + 1, y + CELL - 3);
    if (!(col < COLS - 1 && grid.type[i + 1] === type)) g.moveTo(x + CELL - 1, y + 3), g.lineTo(x + CELL - 1, y + CELL - 3);
    if (!(row > 0 && grid.type[i - COLS] === type)) g.moveTo(x + 3, y + 1), g.lineTo(x + CELL - 3, y + 1);
    if (!(row < ROWS - 1 && grid.type[i + COLS] === type)) g.moveTo(x + 3, y + CELL - 1), g.lineTo(x + CELL - 3, y + CELL - 1);
  }
  g.stroke();
}

const ICE_TONES = ['#f2fdff', '#c9ecfb', '#9bd6f2', '#69b0de', '#dff6ff', '#7cc3ea', '#4f8fc8', '#ffffff'];
const BASES = { [FIRE]: '#c2300a', [LAVA]: '#2b0e08', [WATER]: '#0b6aa8', [CHARGED]: '#1590c4', [ICE]: '#6fb8e0', [EARTH]: '#5d4528', [STORM]: '#2a1470', [MAGNET]: '#241c2c', [CLOUD]: '#2d2570' };
const RIMS = { [FIRE]: '#ffd24a', [LAVA]: '#ff8a2a', [WATER]: '#bff2ff', [CHARGED]: '#ffffff', [ICE]: '#ffffff', [EARTH]: '#b09258', [STORM]: '#ffe23a', [MAGNET]: '#ff6a86', [CLOUD]: '#b9a8ff' };

/** Per-element detail painting, in layer coordinates, clipped to the blob by source-atop. */
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
      g.fillStyle = `rgba(166,92,255,${0.4 + 0.3 * Math.sin(t * 8 + i)})`;
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
      const x = (i % COLS) * CELL + 10;
      const y = Math.floor(i / COLS) * CELL + 10;
      g.fillStyle = '#3b3346';
      g.fillRect(x - 10, y - 10, CELL, 6);
      for (const [k, color] of [[0, '#ff4d6a'], [1, '#5a8cff']]) {
        g.strokeStyle = color;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(x + (k ? 4 : -4), y + 2, 6 + k, t * 2 + k * 3 + hash(i, 1) * 6, t * 2 + k * 3 + hash(i, 1) * 6 + 3.2);
        g.stroke();
      }
    }
  },
  [CLOUD](g, cells, t) {
    for (const i of cells) {
      const x = (i % COLS) * CELL;
      const y = Math.floor(i / COLS) * CELL;
      g.fillStyle = 'rgba(150,130,255,0.5)';
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

const GLOW = {
  [FIRE]: ['#ff8a2a', 0.55, 78],
  [LAVA]: ['#ff6a14', 0.6, 84],
  [STORM]: ['#a65cff', 0.5, 74],
  [CHARGED]: ['#6fe8ff', 0.5, 74],
  [CLOUD]: ['#8f7aff', 0.3, 64],
  [MAGNET]: ['#ff5d7a', 0.22, 56],
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
    if (type === EARTH) {
      traceBlob(ctx, grid, type, cells, FIELD.x + 3, FIELD.y + 5);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fill();
    }
    traceBlob(ctx, grid, type, cells, FIELD.x, FIELD.y);
    if (type === ICE) {
      ctx.strokeStyle = 'rgba(168,230,255,0.3)';
      ctx.lineWidth = 11;
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 5;
    ctx.stroke();

    const layer = layerFor(type);
    const g = layer.getContext('2d');
    g.clearRect(0, 0, FIELD.w, FIELD.h);
    g.globalCompositeOperation = 'source-over';
    traceBlob(g, grid, type, cells, 0, 0);
    g.fillStyle = '#ffffff';
    g.fill();
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = BASES[type];
    g.fillRect(0, 0, FIELD.w, FIELD.h);
    g.globalCompositeOperation = 'source-atop';
    DETAILS[type](g, cells, time);
    rim(g, grid, type, cells, RIMS[type], 3.2);
    g.globalCompositeOperation = 'source-over';
    // Fade cells that are about to expire: blink handled by the per-cell life below.
    ctx.drawImage(layer, FIELD.x, FIELD.y);
    if (type === ICE) drawIceExtras(ctx, grid, cells, time);
  }

  // Cells about to expire blink, so the player sees what is fading.
  ctx.fillStyle = 'rgba(5,6,10,0.55)';
  for (let i = 0; i < grid.type.length; i += 1) {
    if (grid.type[i] !== 0 && grid.life[i] < 1.2 && Math.sin(time * 26) > 0.2) {
      ctx.fillRect(FIELD.x + (i % COLS) * CELL, FIELD.y + Math.floor(i / COLS) * CELL, CELL, CELL);
    }
  }

  ctx.globalCompositeOperation = 'lighter';
  for (const type of [FIRE, LAVA, STORM, CHARGED]) {
    ctx.globalAlpha = type === LAVA ? 0.16 : 0.22;
    ctx.fillStyle = ELEMENTS[type].glow;
    for (const i of lists[type]) ctx.fillRect(FIELD.x + (i % COLS) * CELL + 3, FIELD.y + Math.floor(i / COLS) * CELL + 3, CELL - 6, CELL - 6);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  drawSteam(ctx, lists[STEAM], time);
  drawBolts(ctx, lists[CLOUD], lists[CHARGED], time);
}
