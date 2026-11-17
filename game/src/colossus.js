// The Hollow Colossus's art: a sculpted stone titan with hunched shoulders, a heavy jagged head
// with a glowing eye slit, arms of stacked boulders ending in huge cracked fists (one raised to
// smash), magma light leaking from cracks, a hollow chest with a burning core, moss and rubble,
// and dust and pebbles round its feet. Every body part is an irregular rock outline, never a box.
// Its four armour plates (config PLATES) are glowing slabs on the body; broken ones fall away.
import { PLATES } from './config.js';

const TAU = Math.PI * 2;

const hash = (i, k) => {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** A closed, smoothed outline through `pts` (unit coordinates), so rock reads as rounded stone. */
function smooth(ctx, pts, u) {
  const n = pts.length;
  const mid = (a, b) => [((a[0] + b[0]) / 2) * u, ((a[1] + b[1]) / 2) * u];
  const start = mid(pts[n - 1], pts[0]);
  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i += 1) {
    const end = mid(pts[i], pts[(i + 1) % n]);
    ctx.quadraticCurveTo(pts[i][0] * u, pts[i][1] * u, end[0], end[1]);
  }
  ctx.closePath();
}

function jagged(ctx, pts, u) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => ctx[i === 0 ? 'moveTo' : 'lineTo'](x * u, y * u));
  ctx.closePath();
}

/** An irregular boulder centred at (cx, cy) with radius r (units); `seed` varies its shape. */
function boulderPoints(cx, cy, r, seed) {
  const pts = [];
  for (let k = 0; k < 9; k += 1) {
    const a = (k / 9) * TAU;
    const rr = r * (0.82 + hash(seed, k) * 0.32);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92]);
  }
  return pts;
}

/** Fill the current path as lit stone with a dark outline and a pale top-left rim light. */
function stone(ctx, u, top, bottom, rim, flash, outline = 4.5) {
  const grad = ctx.createLinearGradient(0, -2.6 * u, 0, 1.0 * u);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = flash ? '#ffffff' : grad;
  ctx.fill();
  ctx.strokeStyle = '#05060a';
  ctx.lineWidth = outline;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = rim;
  ctx.lineWidth = 3;
  ctx.translate(-2, -2);
  ctx.stroke();
  ctx.restore();
}

/** Glowing cracks: polylines in unit coordinates, drawn with additive light. */
function cracks(ctx, u, lines, color, power) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [width, alpha] of [[5, 0.25], [2.2, 0.85]]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width * Math.max(0.6, u / 70);
    ctx.globalAlpha = alpha * power;
    ctx.beginPath();
    for (const line of lines) {
      line.forEach(([x, y], i) => ctx[i === 0 ? 'moveTo' : 'lineTo'](x * u, y * u));
    }
    ctx.stroke();
  }
  ctx.restore();
}

function mossAndRubble(ctx, u, spots, flash) {
  if (flash) return;
  for (const [x, y, s] of spots) {
    ctx.fillStyle = '#5f8f3a';
    ctx.beginPath();
    ctx.ellipse(x * u, y * u, s * u * 1.2, s * u * 0.55, 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#86b84e';
    ctx.beginPath();
    ctx.ellipse(x * u - s * u * 0.3, y * u - s * u * 0.2, s * u * 0.5, s * u * 0.25, 0, 0, TAU);
    ctx.fill();
  }
}

function rock(ctx, x, y, s, seed) {
  ctx.fillStyle = '#6c7088';
  ctx.strokeStyle = '#05060a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let k = 0; k < 5; k += 1) {
    const a = (k / 5) * TAU + hash(seed, 1);
    const r = s * (0.6 + hash(seed, k + 2) * 0.6);
    ctx[k === 0 ? 'moveTo' : 'lineTo'](x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** Dust puffs rising round the feet and pebbles dropping off the shoulders. */
function dustAndPebbles(ctx, u, t) {
  for (let k = 0; k < 9; k += 1) {
    const phase = (t * 0.5 + k / 9) % 1;
    const side = k % 2 ? 1 : -1;
    ctx.fillStyle = `rgba(150,150,170,${0.32 * (1 - phase)})`;
    ctx.beginPath();
    ctx.arc(side * (0.5 + (k % 5) * 0.28) * u + Math.sin(t + k) * 4, 0.98 * u - phase * 0.55 * u, (0.16 + phase * 0.3) * u, 0, TAU);
    ctx.fill();
  }
  for (let k = 0; k < 7; k += 1) {
    const phase = (t * 0.7 + k * 0.173) % 1;
    const sx = (k % 2 ? 1 : -1) * (0.9 + hash(k, 7) * 0.7) * u;
    rock(ctx, sx + hash(k, 8) * 14, -1.4 * u + phase * 2.3 * u, 3 + hash(k, 9) * 3, k);
  }
}

/** The arm: shoulder boulders stepping down to a huge cracked fist. `pose` = [[x, y, r]...]. */
function drawArm(ctx, u, pose, side, flash, glow, exposed) {
  pose.forEach(([x, y, r], i) => {
    const last = i === pose.length - 1;
    smooth(ctx, boulderPoints(x, y, r, side * 10 + i * 3), u);
    stone(ctx, u, last ? '#7a7f98' : '#6a6f88', '#2b2f45', 'rgba(210,220,255,0.35)', flash, last ? 5 : 4);
  });
  const [fx, fy, fr] = pose[pose.length - 1];
  for (let k = 0; k < 3; k += 1) {
    const a = -1.2 + k * 0.5;
    smooth(ctx, boulderPoints(fx + Math.cos(a + 1.4) * fr * 0.75, fy + Math.sin(a + 1.4) * fr * 0.75 + fr * 0.15, fr * 0.3, k + side * 5), u);
    stone(ctx, u, '#767b94', '#2b2f45', 'rgba(210,220,255,0.3)', flash, 3);
  }
  const [ex, ey, er] = pose[Math.max(0, pose.length - 2)];
  cracks(ctx, u, [[[fx - fr * 0.5, fy - fr * 0.3], [fx - fr * 0.1, fy + fr * 0.1], [fx + fr * 0.3, fy - fr * 0.2], [fx + fr * 0.55, fy + fr * 0.3]], [[ex - er * 0.4, ey], [ex, ey + er * 0.4], [ex + er * 0.3, ey + er * 0.1]]], glow, exposed ? 1 : 0.8);
}

/** Outline of armour plate `i`: left pauldron, right pauldron, chest lintel, helm crest. */
function plateShape(ctx, i, u) {
  const shapes = [
    [[-1.78, -1.5], [-1.2, -1.85], [-0.8, -1.6], [-0.95, -1.25], [-1.5, -1.1]],
    [[1.78, -1.5], [1.2, -1.85], [0.8, -1.6], [0.95, -1.25], [1.5, -1.1]],
    [[-0.72, -1.02], [-0.2, -1.22], [0.2, -1.22], [0.72, -1.02], [0.58, -0.82], [0.2, -0.95], [-0.2, -0.95], [-0.58, -0.82]],
    [[-0.5, -2.35], [-0.28, -2.72], [0, -2.9], [0.28, -2.72], [0.5, -2.35], [0.2, -2.5], [-0.2, -2.5]],
  ];
  jagged(ctx, shapes[i], u);
}

function drawPlate(ctx, i, u, t, current) {
  ctx.save();
  plateShape(ctx, i, u);
  ctx.fillStyle = PLATES[i].color;
  ctx.globalAlpha = current ? 0.8 + Math.sin(t * 8) * 0.2 : 0.66;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#05060a';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = current ? 8 : 4;
  ctx.strokeStyle = PLATES[i].color;
  ctx.globalAlpha = current ? 0.55 : 0.22;
  ctx.stroke();
  ctx.restore();
}

function fallingShards(ctx, i, u, since) {
  const [px, py] = [[-1.4, -1.5], [1.4, -1.5], [0, -1.0], [0, -2.6]][i];
  ctx.fillStyle = PLATES[i].color;
  ctx.globalAlpha = 1 - since / 1.8;
  for (let k = 0; k < 6; k += 1) {
    const fx = px * u + (k - 2.5) * 0.3 * u * (1 + since);
    const fy = py * u + since * since * 1.6 * u + k * 0.05 * u;
    ctx.beginPath();
    ctx.moveTo(fx, fy - 0.16 * u);
    ctx.lineTo(fx + 0.15 * u, fy + 0.12 * u);
    ctx.lineTo(fx - 0.12 * u, fy + 0.1 * u);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawLegs(ctx, u, t, flash, ruin, lit) {
  for (const side of [-1, 1]) {
    const lift = ruin ? 0 : Math.max(0, Math.sin(t * 1.8 + (side > 0 ? 0 : Math.PI))) * 0.16 * u;
    const pts = [[0.15, -0.1], [0.55, -0.15], [0.95, 0.05], [1.05, 0.55], [1.12, 0.95], [0.85, 1.05], [0.3, 1.02], [0.18, 0.7]].map(([x, y]) => [side * x, y - lift / u]);
    smooth(ctx, pts, u);
    stone(ctx, u, '#5d627c', '#242840', 'rgba(200,210,255,0.3)', flash);
    cracks(ctx, u, [[[side * 0.6, 0.1 - lift / u], [side * 0.7, 0.5 - lift / u], [side * 0.55, 0.85 - lift / u]]], lit, 0.8);
  }
}

function drawTorso(ctx, u, flash, lit, exposed, ruin, t) {
  const hump = [[-1.3, -1.2], [-1.05, -1.55], [-0.55, -1.5], [-0.2, -1.8], [0.3, -1.75], [0.7, -1.5], [1.1, -1.55], [1.35, -1.15], [1.2, -0.45], [0.9, 0.12], [0.2, 0.28], [-0.5, 0.2], [-0.95, 0.1], [-1.25, -0.5]];
  smooth(ctx, hump, u);
  stone(ctx, u, '#70758f', '#262a42', 'rgba(215,225,255,0.4)', flash, 5);
  cracks(ctx, u, [[[-0.9, -1.4], [-0.75, -1.0], [-0.95, -0.7], [-0.7, -0.3]], [[0.95, -1.35], [0.8, -0.95], [1.0, -0.55], [0.75, -0.1]], [[0.1, -1.7], [0.3, -1.45], [0.15, -1.25]], [[-0.3, 0.0], [-0.1, 0.18], [0.3, 0.05]]], lit, exposed ? 1 : 0.85);
  // The hollow chest: a jagged opening with a burning core inside.
  const hole = [];
  for (let k = 0; k < 12; k += 1) {
    const a = (k / 12) * TAU;
    const r = 0.46 + hash(k, 5) * 0.14;
    hole.push([Math.cos(a) * r, -0.52 + Math.sin(a) * r * 0.95]);
  }
  jagged(ctx, hole, u);
  const core = ctx.createRadialGradient(0, -0.52 * u, 0.03 * u, 0, -0.52 * u, 0.55 * u);
  core.addColorStop(0, ruin ? '#7a6a58' : '#fffbe0');
  core.addColorStop(0.3, ruin ? '#2a2018' : exposed ? '#ffb02a' : '#ff7a1a');
  core.addColorStop(0.75, ruin ? '#0e0a08' : '#9a2a08');
  core.addColorStop(1, '#05060a');
  ctx.fillStyle = core;
  ctx.fill();
  ctx.strokeStyle = '#05060a';
  ctx.lineWidth = 4;
  ctx.stroke();
  if (!ruin) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k += 1) {
      const fx = (k - 1.5) * 0.2 * u;
      const lick = Math.sin(t * 9 + k * 2) * 0.06 * u;
      ctx.fillStyle = k % 2 ? '#ffd24a' : '#ff7a1a';
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(fx - 0.1 * u, -0.2 * u);
      ctx.quadraticCurveTo(fx - 0.06 * u + lick, -0.55 * u, fx + lick, -0.85 * u - (k % 2) * 0.1 * u);
      ctx.quadraticCurveTo(fx + 0.07 * u + lick, -0.55 * u, fx + 0.1 * u, -0.2 * u);
      ctx.fill();
    }
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = exposed ? '#ffa030' : '#ff6a1a';
    ctx.beginPath();
    ctx.arc(0, -0.52 * u, 0.8 * u, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function drawHead(ctx, u, flash, ruin, exposed, lit) {
  const head = [[-0.58, -1.55], [-0.66, -1.95], [-0.5, -2.2], [-0.4, -2.12], [-0.34, -2.55], [-0.12, -2.22], [0.04, -2.7], [0.2, -2.24], [0.4, -2.46], [0.5, -2.12], [0.66, -1.92], [0.55, -1.55], [0.28, -1.38], [-0.04, -1.5], [-0.3, -1.38]];
  jagged(ctx, head, u);
  stone(ctx, u, '#7a7f98', '#2a2e48', 'rgba(220,228,255,0.45)', flash, 5);
  cracks(ctx, u, [[[-0.5, -2.0], [-0.3, -2.15], [-0.2, -2.0]], [[0.35, -2.0], [0.5, -1.8], [0.4, -1.6]]], lit, 0.8);
  // The eye slit.
  ctx.beginPath();
  ctx.moveTo(-0.42 * u, -1.86 * u);
  ctx.quadraticCurveTo(0, -2.02 * u, 0.42 * u, -1.9 * u);
  ctx.quadraticCurveTo(0.05 * u, -1.74 * u, -0.42 * u, -1.86 * u);
  ctx.fillStyle = '#05060a';
  ctx.fill();
  if (ruin) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = exposed ? '#ffd24a' : '#ff9a3a';
  ctx.beginPath();
  ctx.moveTo(-0.34 * u, -1.86 * u);
  ctx.quadraticCurveTo(0, -1.97 * u, 0.34 * u, -1.89 * u);
  ctx.quadraticCurveTo(0.04 * u, -1.8 * u, -0.34 * u, -1.86 * u);
  ctx.fill();
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.arc(0, -1.88 * u, 0.5 * u, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw the Colossus centred on the current origin, `u` pixels per unit (about 3.9 units tall with
 * the smashing fist raised). `st` is the creature: plates (broken count), plateT (creature age at
 * which each broke), exposed, flash, age; `st.ruin` draws the cracked, gold-lit husk used behind
 * the win screen.
 */
export function drawColossus(ctx, u, t, st) {
  const broken = st.plates ?? 0;
  const exposed = (st.exposed ?? 0) > 0;
  const ruin = Boolean(st.ruin);
  const flash = (st.flash ?? 0) > 0;
  const lit = ruin ? '#ffd24a' : exposed ? '#ffb347' : '#ff7a2a';
  const swing = ruin ? 0.1 : Math.sin(t * 1.8);
  const smash = ruin ? 0.35 : 0.5 + 0.5 * Math.sin(t * 1.1);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(0, 1.02 * u, 1.9 * u, 0.4 * u, 0, 0, TAU);
  ctx.fill();
  const aura = ctx.createRadialGradient(0, -0.9 * u, 0.3 * u, 0, -0.9 * u, 2.7 * u);
  aura.addColorStop(0, ruin ? 'rgba(255,200,110,0.6)' : exposed ? 'rgba(255,150,40,0.55)' : 'rgba(255,110,50,0.38)');
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = aura;
  ctx.fillRect(-2.8 * u, -3.8 * u, 5.6 * u, 5.6 * u);
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.translate(0, ruin ? 0.12 * u : -Math.abs(Math.sin(t * 1.8)) * 0.045 * u);
  drawLegs(ctx, u, t, flash, ruin, lit);
  // Left arm hangs and swings; the right is raised to smash.
  drawArm(ctx, u, [[-1.4, -1.15, 0.5], [-1.72, -0.55 + swing * 0.04, 0.42], [-1.78 - swing * 0.1, 0.1, 0.38], [-1.66 - swing * 0.2, 0.78, 0.6]], -1, flash, lit, exposed);
  drawArm(ctx, u, [[1.4, -1.2, 0.5], [1.95, -1.6 + (1 - smash) * 0.5, 0.42], [1.95, -2.15 + (1 - smash) * 0.9, 0.38], [1.62, -2.65 + (1 - smash) * 1.35, 0.62]], 1, flash, lit, exposed);
  drawTorso(ctx, u, flash, lit, exposed, ruin, t);
  mossAndRubble(ctx, u, [[-1.2, -1.5, 0.22], [1.15, -1.55, 0.2], [-0.4, -1.58, 0.14], [0.7, -1.52, 0.12]], flash);
  for (const [x, y, s, seed] of [[-1.05, -1.7, 4, 1], [1.0, -1.72, 5, 2], [-1.55, -1.45, 3, 3], [0.35, -1.85, 3, 4]]) rock(ctx, x * u, y * u, s + u * 0.03, seed);
  drawHead(ctx, u, flash, ruin, exposed, lit);
  if (!ruin) {
    for (let i = 0; i < PLATES.length; i += 1) {
      if (i >= broken) drawPlate(ctx, i, u, t, i === broken && !exposed);
      else {
        const since = (st.age ?? 0) - ((st.plateT ?? [])[i] ?? -9);
        if (since >= 0 && since < 1.8) fallingShards(ctx, i, u, since);
      }
    }
  } else {
    // Rim light from behind: a gold edge on the husk.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.ellipse(0, -0.6 * u, 1.9 * u, 2.4 * u, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  dustAndPebbles(ctx, u, t);
}
