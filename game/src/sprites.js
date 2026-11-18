// Procedural creature art in the same arcane style as the materials: each creature is built from
// smoothed rock, clay, brass or vapour shapes with a crisp dark outline, a pale rim light and an
// element-coloured glow, and carries an alchemical glyph or glowing rune. Nothing is loaded.
// Used on the battlefield and, at small sizes, for the HUD's queue icons. `st` is the creature.
import { drawColossus } from './colossus.js';
import { drawGlyph } from './glyphs.js';

const TAU = Math.PI * 2;

/** Each creature's element-coloured glow. */
const GLOW_COLORS = {
  imp: 'rgba(255,90,30,0.45)',
  golem: 'rgba(255,170,60,0.28)',
  wraith: 'rgba(130,200,255,0.5)',
  beetle: 'rgba(190,120,255,0.42)',
  swarm: 'rgba(255,150,50,0.45)',
  ram: 'rgba(120,220,255,0.3)',
};

const hash = (i, k) => {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** A closed, smoothed outline through `pts` (pixel coordinates). */
function smoothClosedShape(ctx, pts) {
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[n - 1], pts[0]);
  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i += 1) {
    const end = mid(pts[i], pts[(i + 1) % n]);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], end[0], end[1]);
  }
  ctx.closePath();
}

const scaled = (r, list) => list.map(([x, y]) => [x * r, y * r]);

/**
 * Fill the current path with a vertical gradient, outline it crisply in near-black and add a
 * pale rim light along its top-left edge. `flash` paints it white (a hit).
 */
function paintSolidBody(ctx, r, top, bottom, rim, flash, width = 3) {
  const grad = ctx.createLinearGradient(0, -r, 0, r);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = flash ? '#ffffff' : grad;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#07080f';
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.translate(-1.6, -1.6);
  ctx.strokeStyle = rim;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function glowDot(ctx, x, y, radius, color, alpha = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

function paintEye(ctx, x, y, w, h, color, tilt = 0) {
  ctx.fillStyle = '#07080f';
  ctx.beginPath();
  ctx.ellipse(x, y, w * 1.3, h * 1.4, tilt, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, w, h, tilt, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Cinder Imp: a small horned flame spirit with an ember core and a fire glyph on its chest. */
function paintImp(ctx, r, t, st, flash) {
  for (let k = 0; k < 3; k += 1) {
    const lick = Math.sin(t * 13 + k * 2) * 0.12 * r;
    const bx = (k - 1) * 0.3 * r;
    ctx.fillStyle = k === 1 ? '#ffd24a' : '#ff7a1a';
    ctx.beginPath();
    ctx.moveTo(bx - 0.16 * r, -0.85 * r);
    ctx.quadraticCurveTo(bx - 0.1 * r + lick, -1.3 * r, bx + lick, -(k === 1 ? 1.75 : 1.5) * r);
    ctx.quadraticCurveTo(bx + 0.14 * r + lick, -1.25 * r, bx + 0.16 * r, -0.85 * r);
    ctx.fill();
  }
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 0.35 * r, -0.7 * r);
    ctx.quadraticCurveTo(side * 0.95 * r, -0.85 * r, side * 0.8 * r, -1.4 * r);
    ctx.quadraticCurveTo(side * 0.55 * r, -1.0 * r, side * 0.18 * r, -0.62 * r);
    ctx.closePath();
    paintSolidBody(ctx, r, '#f4e6c6', '#9a8458', '#ffffff', flash, 2.4);
  }
  smoothClosedShape(ctx, scaled(r, [[-0.7, -0.5], [-0.55, -0.9], [0, -1.0], [0.55, -0.9], [0.7, -0.5], [0.76, 0.1], [0.55, 0.65], [0.28, 0.98], [0, 0.72], [-0.28, 0.98], [-0.55, 0.65], [-0.76, 0.1]]));
  paintSolidBody(ctx, r, '#f0521c', '#6e180a', '#ffc47a', flash);
  for (const side of [-1, 1]) {
    smoothClosedShape(ctx, scaled(r, [[side * 0.7, 0.0], [side * 1.0, 0.15], [side * 1.05, 0.5], [side * 0.8, 0.45]]));
    paintSolidBody(ctx, r, '#c8401a', '#5a1408', '#ffb070', flash, 2.4);
  }
  glowDot(ctx, 0, 0.12 * r, r * 0.7, '#ffcc66', 0.95);
  drawGlyph(ctx, 'fire', 0, 0.16 * r, 0.26 * r, '#fff4cc', 2.2);
  paintEye(ctx, -0.27 * r, -0.4 * r, 0.14 * r, 0.07 * r, '#ffe27a', 0.35);
  paintEye(ctx, 0.27 * r, -0.4 * r, 0.14 * r, 0.07 * r, '#ffe27a', -0.35);
}

/** Mud Golem: a hunched clay and stone figure with moss, glowing eyes and an earth glyph. */
function paintGolem(ctx, r, t, st, flash) {
  for (const side of [-1, 1]) {
    smoothClosedShape(ctx, scaled(r, [[side * 0.2, 0.5], [side * 0.7, 0.55], [side * 0.75, 1.0], [side * 0.25, 1.02]]));
    paintSolidBody(ctx, r, '#6a5a48', '#2a2218', '#b8a080', flash);
  }
  // Long arms ending in boulder fists, swinging a little.
  const sway = Math.sin(t * 5) * 0.06;
  for (const side of [-1, 1]) {
    const arm = [[side * 1.0, -0.2, 0.3], [side * (1.12 + sway), 0.25, 0.28], [side * (1.05 - sway), 0.75, 0.42]];
    for (const [x, y, rad] of arm) {
      smoothClosedShape(ctx, [0, 1, 2, 3, 4, 5, 6].map((k) => [x * r + Math.cos((k / 7) * TAU) * rad * r * (0.85 + hash(k, side + 3) * 0.3), y * r + Math.sin((k / 7) * TAU) * rad * r * 0.9]));
      paintSolidBody(ctx, r, '#8a8a96', '#34343e', '#d6d6e6', flash, 2.6);
    }
  }
  smoothClosedShape(ctx, scaled(r, [[-0.95, 0.0], [-0.8, -0.55], [-0.35, -0.85], [0.1, -0.95], [0.6, -0.7], [0.95, -0.1], [0.8, 0.55], [0.4, 0.85], [-0.4, 0.85], [-0.85, 0.55]]));
  paintSolidBody(ctx, r, '#a47c4c', '#4a3624', '#e0b87c', flash, 3.2);
  // Stone plates on the shoulders and back, moss on top.
  for (const [x, y, s] of [[-0.55, -0.5, 0.3], [0.45, -0.55, 0.28], [0.1, 0.35, 0.25]]) {
    smoothClosedShape(ctx, [0, 1, 2, 3, 4].map((k) => [x * r + Math.cos((k / 5) * TAU) * s * r * (0.8 + hash(k, 7) * 0.4), y * r + Math.sin((k / 5) * TAU) * s * r * 0.8]));
    paintSolidBody(ctx, r, '#8a8a96', '#40404c', '#d0d0e0', flash, 2.2);
  }
  if (!flash) {
    ctx.fillStyle = '#6aa23a';
    for (const [x, y, s] of [[-0.5, -0.88, 0.22], [0.5, -0.8, 0.18], [-0.1, -0.95, 0.15]]) {
      ctx.beginPath();
      ctx.ellipse(x * r, y * r, s * r * 1.2, s * r * 0.5, 0.2, 0, TAU);
      ctx.fill();
    }
  }
  // Small sunk head with amber eyes.
  smoothClosedShape(ctx, scaled(r, [[-0.35, -0.55], [-0.25, -0.85], [0.1, -0.95], [0.4, -0.8], [0.45, -0.5], [0.1, -0.4]]));
  paintSolidBody(ctx, r, '#9a9aa8', '#3a3a46', '#e0e0f0', flash, 2.6);
  paintEye(ctx, -0.08 * r, -0.66 * r, 0.09 * r, 0.06 * r, '#ffb347');
  paintEye(ctx, 0.24 * r, -0.66 * r, 0.09 * r, 0.06 * r, '#ffb347');
  glowDot(ctx, 0, 0.12 * r, r * 0.55, '#ffa030', 0.6);
  drawGlyph(ctx, 'earth', 0, 0.14 * r, 0.27 * r, '#ffd9a0', 2.4);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255,150,40,0.8)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-0.7 * r, -0.1 * r);
  ctx.lineTo(-0.5 * r, 0.1 * r);
  ctx.lineTo(-0.62 * r, 0.4 * r);
  ctx.moveTo(0.6 * r, -0.2 * r);
  ctx.lineTo(0.5 * r, 0.1 * r);
  ctx.lineTo(0.66 * r, 0.35 * r);
  ctx.stroke();
  ctx.restore();
}

/** Mist Wraith: translucent hooded vapour with trailing wisps and glowing eyes. */
function paintWraith(ctx, r, t, st, flash) {
  ctx.lineCap = 'round';
  for (let k = 0; k < 5; k += 1) {
    const x0 = (k - 2) * 0.3 * r;
    const sway = Math.sin(t * 3 + k * 1.3) * 0.28 * r;
    for (const [w, a] of [[0.34, 0.16], [0.22, 0.3], [0.1, 0.5]]) {
      ctx.strokeStyle = `rgba(190,225,255,${a})`;
      ctx.lineWidth = w * r;
      ctx.beginPath();
      ctx.moveTo(x0, 0.4 * r);
      ctx.quadraticCurveTo(x0 + sway, 1.1 * r, x0 - sway * 0.6, (1.6 + (k % 2) * 0.35) * r);
      ctx.stroke();
    }
  }
  ctx.save();
  ctx.globalAlpha = 0.88;
  smoothClosedShape(ctx, scaled(r, [[0, -1.3], [0.45, -0.85], [0.78, 0.0], [0.6, 0.85], [0.25, 0.65], [0, 0.95], [-0.25, 0.65], [-0.6, 0.85], [-0.78, 0.0], [-0.45, -0.85]]));
  paintSolidBody(ctx, r, '#eaf6ff', '#4a7aa8', '#ffffff', flash, 2.8);
  ctx.restore();
  ctx.strokeStyle = 'rgba(90,130,190,0.5)';
  ctx.lineWidth = 1.6;
  for (const [dx, dy, a0, a1] of [[-0.3, 0.2, 3.6, 5.6], [0.3, 0.35, 3.4, 5.4]]) {
    ctx.beginPath();
    ctx.arc(dx * r, dy * r, 0.3 * r, a0, a1);
    ctx.stroke();
  }
  ctx.fillStyle = '#0a0618';
  ctx.beginPath();
  ctx.ellipse(0, -0.4 * r, 0.4 * r, 0.48 * r, 0, 0, TAU);
  ctx.fill();
  paintEye(ctx, -0.17 * r, -0.45 * r, 0.1 * r, 0.14 * r, '#e8f8ff', 0.15);
  paintEye(ctx, 0.17 * r, -0.45 * r, 0.1 * r, 0.14 * r, '#e8f8ff', -0.15);
  glowDot(ctx, 0, -0.45 * r, r * 0.8, '#9fd8ff', 0.5);
}

/** Spark Beetle: a brass-shelled beetle crackling with violet arcs (and a charge aura). */
function paintBeetle(ctx, r, t, st, flash) {
  const charge = st.charge ?? 0;
  if (charge > 0.05) glowDot(ctx, 0, 0, r * (1.5 + charge * 1.5 + Math.sin(t * 30) * 0.1), '#c58aff', 0.3 + charge * 0.5);
  ctx.strokeStyle = '#2a1c08';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(side * 0.55 * r, i * 0.38 * r);
      ctx.lineTo(side * 1.15 * r, i * 0.7 * r + Math.sin(t * 12 + i + side) * 2);
      ctx.lineTo(side * 1.2 * r, i * 0.7 * r + 0.3 * r);
      ctx.stroke();
    }
  }
  smoothClosedShape(ctx, scaled(r, [[0, -0.95], [0.6, -0.7], [0.85, 0.0], [0.6, 0.8], [0, 1.02], [-0.6, 0.8], [-0.85, 0.0], [-0.6, -0.7]]));
  paintSolidBody(ctx, r, charge > 0.5 && Math.sin(t * 28) > 0 ? '#fff6d0' : '#f2c75a', '#7a4c10', '#fff2b8', flash, 3);
  ctx.strokeStyle = 'rgba(40,24,6,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -0.6 * r);
  ctx.lineTo(0, 0.95 * r);
  ctx.moveTo(-0.72 * r, 0.1 * r);
  ctx.quadraticCurveTo(0, 0.3 * r, 0.72 * r, 0.1 * r);
  ctx.stroke();
  drawGlyph(ctx, 'storm', 0, 0.35 * r, 0.22 * r, '#7a2cd0', 2);
  smoothClosedShape(ctx, scaled(r, [[-0.4, -0.95], [0, -1.3], [0.4, -0.95], [0.25, -0.7], [-0.25, -0.7]]));
  paintSolidBody(ctx, r, '#6a4a1a', '#241606', '#d8b060', flash, 2.4);
  paintEye(ctx, -0.15 * r, -1.0 * r, 0.08 * r, 0.06 * r, '#d9a8ff');
  paintEye(ctx, 0.15 * r, -1.0 * r, 0.08 * r, 0.06 * r, '#d9a8ff');
  // Violet arcs crackling off the shell, re-rolled many times a second.
  const frame = Math.floor(t * 14);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  for (let k = 0; k < 3; k += 1) {
    const a = hash(frame, k) * TAU;
    const pts = [[Math.cos(a) * 0.5 * r, Math.sin(a) * 0.5 * r]];
    for (let s = 1; s <= 3; s += 1) pts.push([Math.cos(a + (hash(frame, k + s * 5) - 0.5) * 0.9) * (0.5 + s * 0.4) * r, Math.sin(a + (hash(frame, k + s * 7) - 0.5) * 0.9) * (0.5 + s * 0.4) * r]);
    for (const [c, w] of [['rgba(170,100,255,0.45)', 4.5], ['#e8d0ff', 1.6]]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      pts.forEach((p, i) => ctx[i === 0 ? 'moveTo' : 'lineTo'](p[0], p[1]));
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Ember Swarm: tiny glowing moths circling each other. */
function paintSwarm(ctx, r, t, st, flash) {
  for (let i = 0; i < 3; i += 1) {
    const a = t * 4 + i * 2.1;
    const x = Math.cos(a) * r * 0.85;
    const y = Math.sin(a * 1.3) * r * 0.8;
    const m = r * 0.62;
    glowDot(ctx, x, y, m * 1.8, '#ff9a3a', 0.75);
    const flap = 0.35 + 0.65 * Math.abs(Math.sin(t * 20 + i * 1.7));
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(side * -0.35);
      ctx.scale(side * flap, 1);
      smoothClosedShape(ctx, [[0, -0.1 * m], [0.9 * m, -0.9 * m], [1.25 * m, -0.1 * m], [0.8 * m, 0.55 * m]]);
      paintSolidBody(ctx, m, '#ffc060', '#e0541a', '#fff0b8', flash, 1.8);
      ctx.restore();
    }
    ctx.fillStyle = '#2a1408';
    ctx.beginPath();
    ctx.ellipse(x, y, m * 0.2, m * 0.5, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#2a1408';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y - m * 0.4);
    ctx.lineTo(x - m * 0.3, y - m * 0.9);
    ctx.moveTo(x, y - m * 0.4);
    ctx.lineTo(x + m * 0.3, y - m * 0.9);
    ctx.stroke();
    glowDot(ctx, x, y, m * 0.5, '#fff6d0', 0.9);
  }
}

/** Stone Ram: a rock-plated ram with glowing rune horns. */
function paintRam(ctx, r, t, st, flash) {
  for (const [x, y] of [[-0.55, 0.55], [-0.15, 0.6], [0.35, 0.6], [0.7, 0.55]]) {
    smoothClosedShape(ctx, scaled(r, [[x - 0.18, y], [x + 0.18, y], [x + 0.2, y + 0.5], [x - 0.2, y + 0.5]]));
    paintSolidBody(ctx, r, '#6a707c', '#24282f', '#c0c8d8', flash, 2.4);
  }
  smoothClosedShape(ctx, scaled(r, [[-0.95, 0.0], [-0.75, -0.5], [-0.2, -0.7], [0.45, -0.6], [0.85, -0.2], [0.85, 0.35], [0.4, 0.7], [-0.4, 0.72], [-0.85, 0.45]]));
  paintSolidBody(ctx, r, '#8a909e', '#3a3f4a', '#d6dcec', flash, 3.2);
  // Overlapping rock plates along the back.
  for (const [x, y, s] of [[-0.55, -0.15, 0.36], [-0.1, -0.3, 0.36], [0.35, -0.2, 0.34], [-0.35, 0.3, 0.3], [0.2, 0.28, 0.3]]) {
    smoothClosedShape(ctx, [0, 1, 2, 3, 4, 5].map((k) => [x * r + Math.cos((k / 6) * TAU) * s * r * (0.8 + hash(k, 11) * 0.35), y * r + Math.sin((k / 6) * TAU) * s * r * 0.75]));
    paintSolidBody(ctx, r, '#9aa0ae', '#4a505c', '#e4e8f4', flash, 2.2);
  }
  // Head with ember eyes, horns with glowing runes.
  smoothClosedShape(ctx, scaled(r, [[0.7, -0.5], [1.15, -0.45], [1.45, -0.05], [1.3, 0.4], [0.85, 0.35], [0.7, 0.0]]));
  paintSolidBody(ctx, r, '#7a808e', '#2e323c', '#cdd4e4', flash, 2.8);
  paintEye(ctx, 1.05 * r, -0.12 * r, 0.1 * r, 0.07 * r, '#ff8a3a');
  const runeColor = '#7ae8ff';
  for (const dy of [-0.2, 0.15]) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#07080f';
    ctx.lineWidth = r * 0.34;
    ctx.beginPath();
    ctx.arc(0.8 * r, (dy - 0.15) * r, 0.6 * r, -2.7, 0.5 + dy);
    ctx.stroke();
    ctx.strokeStyle = flash ? '#ffffff' : '#a8aebc';
    ctx.lineWidth = r * 0.24;
    ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = runeColor;
    ctx.lineWidth = 2.4;
    ctx.setLineDash([3, 6]);
    ctx.lineDashOffset = -t * 10;
    ctx.beginPath();
    ctx.arc(0.8 * r, (dy - 0.15) * r, 0.6 * r, -2.5, 0.4 + dy);
    ctx.stroke();
    ctx.restore();
  }
  glowDot(ctx, 0.9 * r, -0.4 * r, r * 0.7, runeColor, 0.35);
}

const painters = { imp: paintImp, golem: paintGolem, wraith: paintWraith, beetle: paintBeetle, swarm: paintSwarm, ram: paintRam };

/**
 * Draw creature `kindId` centred at canvas pixel (x, y) with body radius `r` pixels.
 * `t` is time in seconds for animation; `st` carries flash, frozen, charge, plates, exposed.
 */
const RIM_COLORS = { imp: '#ffa060', golem: '#ffd890', wraith: '#c8ecff', beetle: '#e0b0ff', swarm: '#ffb868', ram: '#f0e4c8' };
let finishA = null;
let finishB = null;
let finishC = null;

/**
 * The shared finish for every creature: the painter draws into a scratch canvas, then one light from
 * the top left shades it (light side, shadow side, a small highlight), an element-coloured rim
 * catches the lit edge, and a crisp dark outline is stamped around the silhouette.
 */
function drawWithFinish(ctx, kindId, r, draw, flash = false) {
  const half = Math.ceil(r * 2.6) + 8;
  const size = half * 2;
  if (!finishA) {
    [finishA, finishB, finishC] = [0, 1, 2].map(() => document.createElement('canvas'));
    for (const c of [finishA, finishB, finishC]) c.width = c.height = 320;
  }
  const a = finishA.getContext('2d');
  const b = finishB.getContext('2d');
  const c = finishC.getContext('2d');
  a.globalCompositeOperation = 'source-over';
  a.clearRect(0, 0, size, size);
  a.save();
  a.translate(half, half);
  draw(a);
  a.restore();
  a.globalCompositeOperation = 'source-atop';
  const lit = a.createLinearGradient(0, 0, size, size);
  lit.addColorStop(0, 'rgba(255,255,255,0.2)');
  lit.addColorStop(0.5, 'rgba(255,255,255,0)');
  lit.addColorStop(1, 'rgba(0,0,10,0.3)');
  a.fillStyle = lit;
  a.fillRect(0, 0, size, size);
  const spot = a.createRadialGradient(half - r * 0.38, half - r * 0.45, 0, half - r * 0.38, half - r * 0.45, r * 0.5);
  spot.addColorStop(0, 'rgba(255,255,255,0.4)');
  spot.addColorStop(1, 'rgba(255,255,255,0)');
  a.fillStyle = spot;
  a.fillRect(0, 0, size, size);
  if (flash) {
    a.fillStyle = 'rgba(255,255,255,0.7)';
    a.fillRect(0, 0, size, size);
  }
  // Rim light: the silhouette minus itself shifted down-right leaves the lit top-left edge.
  b.globalCompositeOperation = 'source-over';
  b.clearRect(0, 0, size, size);
  b.drawImage(finishA, 0, 0, size, size, 0, 0, size, size);
  b.globalCompositeOperation = 'destination-out';
  b.drawImage(finishA, 0, 0, size, size, 2, 2, size, size);
  b.globalCompositeOperation = 'source-in';
  b.fillStyle = RIM_COLORS[kindId] ?? '#ffffff';
  b.fillRect(0, 0, size, size);
  a.fillStyle = 'rgba(22,28,50,0.28)';
  a.globalCompositeOperation = 'source-atop';
  a.fillRect(0, 0, size, size);
  a.globalCompositeOperation = 'source-over';
  // Crisp outline.
  c.globalCompositeOperation = 'source-over';
  c.clearRect(0, 0, size, size);
  c.drawImage(finishA, 0, 0, size, size, 0, 0, size, size);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = '#06080f';
  c.fillRect(0, 0, size, size);
  const w = Math.max(1, Math.min(2, r / 7));
  for (let k = 0; k < 8; k += 1) ctx.drawImage(finishC, 0, 0, size, size, -half + Math.cos((k / 8) * TAU) * w, -half + Math.sin((k / 8) * TAU) * w, size, size);
  ctx.save();
  ctx.filter = 'saturate(0.42) brightness(0.95)';
  ctx.drawImage(finishA, 0, 0, size, size, -half, -half, size, size);
  ctx.restore();
  ctx.globalAlpha = 0.9;
  ctx.drawImage(finishB, 0, 0, size, size, -half, -half, size, size);
  ctx.globalAlpha = 1;
  const core = ctx.createRadialGradient(0, -r * 0.1, 0, 0, -r * 0.1, r * 0.5);
  core.addColorStop(0, RIM_COLORS[kindId] ?? '#ffffff');
  core.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = core;
  ctx.fillRect(-r, -r * 1.1, r * 2, r * 2);
  ctx.restore();
}

export function drawCreatureSprite(ctx, kindId, x, y, r, t, st) {
  const flashing = (st.flash ?? 0) > 0;
  ctx.save();
  ctx.translate(x, y);
  if (kindId !== 'colossus') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.95, r * 1.0, r * 0.3, 0, 0, TAU);
    ctx.fill();
    const glow = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2);
    glow.addColorStop(0, GLOW_COLORS[kindId]);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (kindId === 'colossus') drawColossus(ctx, r, t, st);
  else {
    const bob = kindId === 'golem' || kindId === 'ram' ? Math.sin(t * 6) * r * 0.05 : Math.sin(t * 9) * r * 0.08;
    ctx.translate(0, bob);
    const flicker = kindId === 'imp' || kindId === 'swarm' ? 1 + 0.03 * Math.sin(t * 15) : kindId === 'wraith' ? 1 + 0.02 * Math.sin(t * 5) : 1;
    drawWithFinish(ctx, kindId, r, (g) => {
      if ((st.face ?? 1) < 0) g.scale(-1, 1);
      g.scale(flicker, 2 - flicker);
      painters[kindId](g, r, t, st, flashing);
    }, flashing);
  }
  if ((st.frozen ?? 0) > 0) {
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = '#bfeaff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-r * 1.1, -r * 1.1, r * 2.2, r * 2.2, r * 0.3);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if ((st.steamed ?? 0) > 0) {
    ctx.fillStyle = 'rgba(230,245,250,0.45)';
    ctx.beginPath();
    ctx.arc(0, -r * 0.2, r * 1.2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
